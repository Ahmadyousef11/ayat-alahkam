/* بناء شبكة بطاقات المجالس */
const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

function hhmm(sec) {
  if (!sec) return null;
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${AR(h)}س ${AR(m)}د` : `${AR(m)}د`;
}

const ICON_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6l-6 6 6 6"/></svg>';

const getCourse = () => window.COURSE
  ? Promise.resolve(window.COURSE)
  : fetch('data/course.json').then(r => r.json());

getCourse()
  .then(data => {
    const grid = document.getElementById('grid');
    grid.innerHTML = data.lectures.map((L, i) => {
      const dur = hhmm(L.duration);
      const noAudio = !L.audio;
      return `
      <a class="card reveal" href="lecture.html?id=${L.id}" style="animation-delay:${i * 60}ms">
        <div class="thumb">
          <span class="num">${AR(L.id)}</span>
          <img src="img/thumb${L.id}.webp" alt="غلاف ${L.title}" loading="lazy" width="640" height="360">
          <div class="meta-strip">
            <span class="pill">🖼️ ${AR(L.slides)} شريحة</span>
            ${dur ? `<span class="pill">⏱️ ${dur}</span>` : ''}
            ${noAudio ? '<span class="pill warn">بلا تسجيل صوتي</span>' : ''}
          </div>
        </div>
        <div class="body">
          <h3>${L.title}</h3>
          <p class="sub">${L.subtitle}</p>
          <p class="summary">${L.summary}</p>
          <span class="go">ادخل المجلس ${ICON_ARROW}</span>
        </div>
      </a>`;
    }).join('');
  })
  .catch(err => {
    document.getElementById('grid').innerHTML =
      '<p style="grid-column:1/-1;text-align:center;color:var(--text-soft)">تعذّر تحميل بيانات الدورة. شغّل الموقع عبر خادم محلي (وليس بفتح الملف مباشرة).</p>';
    console.error(err);
  });
