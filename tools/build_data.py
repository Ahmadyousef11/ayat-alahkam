# -*- coding: utf-8 -*-
"""يعيد توليد ملفات البيانات الجاهزة للمتصفح:

  data/course.js   ← data/course.json
  data/timings.js  ← data/timings/lecN.json
  data/topics.js   ← data/topics/lecN.json     (فهرس المواضيع)
  data/search.js   ← subs/lecN.vtt             (فهرس البحث الشامل)

يُستدعى تلقائيًّا عند تشغيل serve.py، أو يدويًّا:  python tools/build_data.py
"""
import json, glob, os, re

base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(base)

W = lambda p, s: open(p, 'w', encoding='utf8').write(s)
J = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))


def num(path):
    return int(re.search(r'lec(\d+)', os.path.basename(path)).group(1))


def load_dir(pattern):
    out = {}
    for f in glob.glob(pattern):
        out[num(f)] = json.load(open(f, encoding='utf8'))
    return out


# ---------- بيانات الدورة ----------
course = open('data/course.json', encoding='utf8').read()
W('data/course.js', 'window.COURSE = ' + course + ';\n')

# ---------- التوقيتات والمواضيع ----------
timings = load_dir('data/timings/lec*.json')
W('data/timings.js', 'window.TIMINGS = ' + J(timings) + ';\n')

topics = load_dir('data/topics/lec*.json')
W('data/topics.js', 'window.TOPICS = ' + J(topics) + ';\n')

# ---------- فهرس البحث الشامل ----------
TS = re.compile(r'(\d+):(\d+):([\d.]+)\s*-->')


def read_vtt(path):
    """يعيد [[الثانية, النص], ...] لكل مقطع."""
    cues = []
    for block in open(path, encoding='utf8').read().split('\n\n')[1:]:
        lines = [x for x in block.strip().split('\n') if x.strip()]
        m = TS.search(block)
        if not m or len(lines) < 2:
            continue
        sec = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
        text = ' '.join(lines[2:]).strip() if len(lines) > 2 else ''
        if text:
            cues.append([round(sec), text])
    return cues


index = {}
total = 0
for f in sorted(glob.glob('subs/lec*.vtt'), key=num):
    cues = read_vtt(f)
    if cues:
        index[num(f)] = cues
        total += len(cues)

W('data/search.js', 'window.SEARCH_INDEX = ' + J(index) + ';\n')

size = os.path.getsize('data/search.js') // 1024
print('تم التوليد ✓')
print(f'  التوقيتات : {sorted(timings)}')
print(f'  المواضيع  : {sorted(topics)}  ({sum(len(v) for v in topics.values())} موضوعًا)')
print(f'  فهرس البحث: {total} مقطعًا  ({size} ك.ب)')
