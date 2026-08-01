/* ===== الصفحة الرئيسية: البطاقات + التقدّم + البحث الشامل ===== */
const { AR, fmt, esc, norm, highlight } = window.Arabic;

function hhmm(sec) {
  if (!sec) return null;
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${AR(h)}س ${AR(m)}د` : `${AR(m)}د`;
}

const ICON_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6l-6 6 6 6"/></svg>';

const getCourse = () => window.COURSE
  ? Promise.resolve(window.COURSE)
  : fetch('data/course.json').then(r => r.json());

let COURSE_DATA = null;

getCourse()
  .then(data => {
    COURSE_DATA = data;
    paintGrid(data);
    paintResume(data);
    initSearch(data);
  })
  .catch(err => {
    document.getElementById('grid').innerHTML =
      '<p style="grid-column:1/-1;text-align:center;color:var(--text-soft)">تعذّر تحميل بيانات الدورة. شغّل الموقع عبر خادم محلي (وليس بفتح الملف مباشرة).</p>';
    console.error(err);
  });

/* ---------- شبكة البطاقات ---------- */
function paintGrid(data) {
  const grid = document.getElementById('grid');
  grid.innerHTML = data.lectures.map((L, i) => {
    const dur = hhmm(L.duration);
    const pct = window.Store ? Store.pct(L.id) : 0;
    const done = pct > 97;
    return `
      <a class="card reveal" href="lecture.html?id=${L.id}" style="animation-delay:${i * 60}ms">
        <div class="thumb">
          <span class="num">${AR(L.id)}</span>
          <img src="img/thumb${L.id}.webp" alt="غلاف ${esc(L.title)}" loading="lazy" width="640" height="360">
          <div class="meta-strip">
            <span class="pill">🖼️ ${AR(L.slides)} شريحة</span>
            ${dur ? `<span class="pill">⏱️ ${dur}</span>` : ''}
            ${!L.audio ? '<span class="pill warn">بلا تسجيل صوتي</span>' : ''}
          </div>
          ${pct ? `<div class="card-prog" title="استمعت ${AR(pct)}٪"><i style="width:${pct}%"></i></div>` : ''}
          ${done ? '<span class="done-badge" title="اكتمل الاستماع">✓</span>' : ''}
        </div>
        <div class="body">
          <h3>${esc(L.title)}</h3>
          <p class="sub">${esc(L.subtitle)}</p>
          <p class="summary">${esc(L.summary)}</p>
          <span class="go">ادخل المجلس ${ICON_ARROW}</span>
        </div>
      </a>`;
  }).join('');
}

/* ---------- تابع من حيث توقّفت ---------- */
function paintResume(data) {
  if (!window.Store) return;
  const p = Store.last();
  if (!p) return;
  const L = data.lectures.find(x => x.id === p.id);
  if (!L) return;
  const pct = p.d ? Math.round(p.t / p.d * 100) : 0;
  const box = document.getElementById('resume');
  box.hidden = false;
  box.innerHTML = `
    <a class="resume-card" href="lecture.html?id=${L.id}&t=${p.t}">
      <span class="resume-ico">▶</span>
      <span class="resume-txt">
        <b>تابع من حيث توقّفت</b>
        <span>المجلس ${AR(L.id)} — ${esc(L.title)} · عند ${fmt(p.t)} (${AR(pct)}٪)</span>
      </span>
      <span class="resume-go">${ICON_ARROW}</span>
    </a>`;
}

/* ---------- البحث الشامل ---------- */
function initSearch(data) {
  const input = document.getElementById('q');
  const out = document.getElementById('qOut');
  const clear = document.getElementById('qClear');
  const titles = {};
  data.lectures.forEach(L => { titles[L.id] = L; });

  let index = null, loading = null, timer;

  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (loading) return loading;
    out.hidden = false;
    out.innerHTML = '<p class="find-msg">…يُحمَّل فهرس البحث لأول مرة</p>';
    loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'data/search.js';
      s.onload = () => { index = window.SEARCH_INDEX || {}; res(index); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
    return loading;
  }

  function run(q) {
    clear.hidden = !q;
    if (!q || norm(q).length < 2) { out.hidden = true; out.innerHTML = ''; return; }
    loadIndex().then(idx => search(q, idx)).catch(() => {
      out.hidden = false;
      out.innerHTML = '<p class="find-msg">تعذّر تحميل فهرس البحث. شغّل الموقع عبر خادم.</p>';
    });
  }

  function search(q, idx) {
    if (input.value.trim() !== q) return;          /* تجاوزته كتابةٌ أحدث */
    const nq = norm(q);
    const groups = [];
    let total = 0;
    Object.keys(idx).sort((a, b) => a - b).forEach(id => {
      const hits = [];
      for (const [t, text] of idx[id]) {
        if (norm(text).indexOf(nq) === -1) continue;
        hits.push({ t, text });
        total++;
        if (hits.length >= 200) break;
      }
      if (hits.length) groups.push({ id: +id, hits });
    });

    if (!total) {
      out.hidden = false;
      out.innerHTML = `<p class="find-msg">لا نتائج لِـ «${esc(q)}». جرّب عبارة أقصر — البحث يتجاهل الهمزات والتشكيل.</p>`;
      return;
    }

    const MAX = 6;   /* نتائج معروضة لكل مجلس قبل «المزيد» */
    out.hidden = false;
    out.innerHTML = `
      <p class="find-msg">${AR(total)} نتيجة في ${AR(groups.length)} ${groups.length === 1 ? 'مجلس' : 'مجالس'}</p>
      ${groups.map(g => {
        const L = titles[g.id] || {};
        const rows = g.hits.map((h, i) => `
          <a class="find-row${i >= MAX ? ' extra' : ''}" href="lecture.html?id=${g.id}&t=${h.t}">
            <time>${fmt(h.t)}</time>
            <p>${highlight(h.text, q).html}</p>
          </a>`).join('');
        return `
          <section class="find-grp" data-id="${g.id}">
            <h3><span class="find-n">${AR(g.id)}</span> ${esc(L.title || '')}
                <small>${AR(g.hits.length)} نتيجة</small></h3>
            ${rows}
            ${g.hits.length > MAX
              ? `<button class="find-more" data-id="${g.id}">إظهار ${AR(g.hits.length - MAX)} نتيجة أخرى</button>`
              : ''}
          </section>`;
      }).join('')}`;
  }

  out.addEventListener('click', e => {
    const b = e.target.closest('.find-more');
    if (!b) return;
    const grp = out.querySelector(`.find-grp[data-id="${b.dataset.id}"]`);
    grp.querySelectorAll('.extra').forEach(r => r.classList.remove('extra'));
    b.remove();
  });

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    timer = setTimeout(() => run(q), 200);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { input.value = ''; run(''); }
  });
  clear.addEventListener('click', () => { input.value = ''; input.focus(); run(''); });

  /* ?q=... لمشاركة نتيجة بحث */
  const pre = new URLSearchParams(location.search).get('q');
  if (pre) { input.value = pre; run(pre.trim()); }

  /* اختصار: / لبدء البحث */
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
  });
}
