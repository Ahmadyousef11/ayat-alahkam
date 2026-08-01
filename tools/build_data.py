# -*- coding: utf-8 -*-
"""يعيد توليد data/course.js و data/timings.js من ملفات JSON."""
import json, glob, os
base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(base)
c = open('data/course.json', encoding='utf8').read()
open('data/course.js', 'w', encoding='utf8').write('window.COURSE = ' + c + ';\n')
t = {}
for f in glob.glob('data/timings/lec*.json'):
    t[int(os.path.basename(f)[3:-5])] = json.load(open(f, encoding='utf8'))
open('data/timings.js', 'w', encoding='utf8').write(
    'window.TIMINGS = ' + json.dumps(t, ensure_ascii=False) + ';\n')
print('تم التوليد ✓  المجالس ذات التوقيت:', sorted(t))
