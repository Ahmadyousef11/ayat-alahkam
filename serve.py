# -*- coding: utf-8 -*-
"""خادم محلي يدعم طلبات النطاق (HTTP Range).

خادم بايثون الافتراضي (http.server) لا يستجيب لترويسة Range، ولهذا يتعذّر على
المتصفح القفز داخل الملف الصوتي أو الانتقال إلى شريحة موقّتة. هذا الخادم يضيف
دعم النطاقات (206 Partial Content) فيعمل التقديم والتأخير والمزامنة كما ينبغي.

التشغيل:  python serve.py        ثم افتح  http://localhost:8000
"""
import os
import re
import sys
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
RANGE_RE = re.compile(r'bytes=(\d*)-(\d*)')


class RangeHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
        '.webp': 'image/webp',
        '.vtt': 'text/vtt;charset=utf-8',
        '.json': 'application/json;charset=utf-8',
        '.js': 'text/javascript;charset=utf-8',
        '.css': 'text/css;charset=utf-8',
        '.html': 'text/html;charset=utf-8',
    }

    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def send_head(self):
        rng = self.headers.get('Range')
        if not rng:
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, 'File not found')
            return None

        size = os.fstat(f.fileno()).st_size
        m = RANGE_RE.match(rng.strip())
        if not m:
            f.close()
            self.send_error(400, 'Invalid Range')
            return None

        start_s, end_s = m.group(1), m.group(2)
        if start_s == '':                       # bytes=-N  → آخر N بايت
            length = min(int(end_s or 0), size)
            start = max(0, size - length)
            end = size - 1
        else:
            start = int(start_s)
            end = int(end_s) if end_s else size - 1
        end = min(end, size - 1)

        if start >= size or start > end:
            f.close()
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.end_headers()
            return None

        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.end_headers()
        f.seek(start)
        self._remaining = end - start + 1
        return f

    def copyfile(self, src, dst):
        """ينسخ المقدار المطلوب فقط عند وجود نطاق."""
        remaining = getattr(self, '_remaining', None)
        if remaining is None:
            return super().copyfile(src, dst)
        self._remaining = None
        while remaining > 0:
            chunk = src.read(min(64 * 1024, remaining))
            if not chunk:
                break
            try:
                dst.write(chunk)
            except (BrokenPipeError, ConnectionResetError):
                break                        # المتصفح أغلق الاتصال بعد القفز
            remaining -= len(chunk)

    def log_message(self, fmt, *args):
        pass                                  # صامت — لا يغرق الطرفية


def rebuild_data():
    """يعيد توليد data/course.js و data/timings.js من ملفات JSON عند كل تشغيل،
    حتى يظهر أثر أي تعديل يدوي في الـ JSON بمجرّد إعادة تشغيل الخادم."""
    import json
    import glob
    try:
        course = open('data/course.json', encoding='utf8').read()
        open('data/course.js', 'w', encoding='utf8').write('window.COURSE = ' + course + ';\n')
        timings = {}
        for f in glob.glob('data/timings/lec*.json'):
            num = int(re.search(r'lec(\d+)', os.path.basename(f)).group(1))
            timings[num] = json.load(open(f, encoding='utf8'))
        open('data/timings.js', 'w', encoding='utf8').write(
            'window.TIMINGS = ' + json.dumps(timings, ensure_ascii=False) + ';\n')
        n = len(json.loads(course)['lectures'])
        print(f'  ✓ حُدِّثت البيانات: {n} مجالس، توقيتات {sorted(timings)}')
    except FileNotFoundError as e:
        print(f'  ⚠ ملف مفقود: {e.filename}')
    except json.JSONDecodeError as e:
        print(f'  ✗ خطأ في صياغة JSON: {e}')
        print('    راجع الملف — الغالب فاصلة زائدة أو ناقصة أو علامة تنصيص غير مغلقة.')


def setup_console():
    """يهيّئ طرفية ويندوز لعرض العربية (UTF-8) بدل الترميز القديم."""
    if os.name != 'nt':
        return
    try:
        import ctypes
        ctypes.windll.kernel32.SetConsoleOutputCP(65001)
        ctypes.windll.kernel32.SetConsoleCP(65001)
    except Exception:
        pass
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass


if __name__ == '__main__':
    setup_console()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    rebuild_data()
    url = f'http://localhost:{PORT}'
    handler = partial(RangeHandler, directory=os.getcwd())
    try:
        srv = ThreadingHTTPServer(('127.0.0.1', PORT), handler)
    except OSError:
        print(f'\n  المنفذ {PORT} مشغول — قد يكون الخادم يعمل بالفعل.')
        print(f'  افتح {url} في المتصفح، أو شغّل:  python serve.py 8001\n')
        sys.exit(1)
    srv.daemon_threads = True
    print('=' * 54)
    print('  موقع دورة آيات الأحكام من سورة البقرة')
    print(f'  الموقع يعمل على:  {url}')
    print('  للإيقاف: أغلق النافذة أو اضغط Ctrl+C')
    print('=' * 54)
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\nتم الإيقاف.')
