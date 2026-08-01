/* عامل الخدمة: يجعل هيكل الموقع يعمل دون إنترنت،
   ويحتفظ بما استُمع إليه من صوت وشرائح في ذاكرة المتصفح. */
const V = 'ayat-v1';
const SHELL = [
  './', './index.html', './lecture.html',
  './assets/css/style.css',
  './assets/js/arabic.js', './assets/js/store.js',
  './assets/js/theme.js', './assets/js/home.js', './assets/js/lecture.js',
  './data/course.js', './data/timings.js', './data/topics.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  /* الصوت: يمرّ مباشرة إلى الشبكة ليعمل طلب النطاق (Range) والقفز داخل الملف */
  if (/\.(mp3|ogg)$/i.test(url.pathname) || req.headers.has('range')) return;

  /* الباقي: من الذاكرة أولًا، ثم الشبكة مع الحفظ */
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(V).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
