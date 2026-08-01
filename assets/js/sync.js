/* ===== محرّر مزامنة الشرائح ===== */
(() => {
  const AR = s => String(s).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const $ = id => document.getElementById(id);
  const fmt = t => {
    if (!isFinite(t)) return '٠:٠٠';
    t = Math.max(0, Math.floor(t));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return AR(h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                : `${m}:${String(s).padStart(2, '0')}`);
  };
  const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6c0 .8.9 1.3 1.6.9l10.5-6.8a1 1 0 0 0 0-1.7L9.6 4.3A1 1 0 0 0 8 5.2Z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="4.5" width="4" height="15" rx="1.3"/><rect x="13.5" y="4.5" width="4" height="15" rx="1.3"/></svg>';

  const audio = $('audio');
  let course = null, L = null, times = [0], idx = 0;

  const getCourse = () => window.COURSE
    ? Promise.resolve(window.COURSE)
    : fetch('data/course.json').then(r => r.json());

  getCourse().then(d => {
    course = d;
    $('pick').innerHTML = d.lectures.map(l =>
      `<option value="${l.id}"${l.audio ? '' : ' disabled'}>المجلس ${AR(l.id)} — ${l.title}${l.audio ? '' : ' (بلا صوت)'}</option>`).join('');
    const q = parseInt(new URLSearchParams(location.search).get('id') || '', 10);
    $('pick').value = (q && d.lectures.find(x => x.id === q && x.audio)) ? q : (d.lectures.find(x => x.audio) || {}).id;
    load();
  });

  $('pick').addEventListener('change', load);

  function load() {
    L = course.lectures.find(x => x.id === +$('pick').value);
    times = [0]; idx = 0;
    const srcs = [];
    if (L.audioOpus) srcs.push(`<source src="${L.audioOpus}" type="audio/ogg; codecs=opus">`);
    if (L.audio) srcs.push(`<source src="${L.audio}" type="audio/mpeg">`);
    audio.innerHTML = srcs.join('');
    audio.load();
    show(0); render();
  }

  const slideSrc = i => `slides/${L.id}/${String(i + 1).padStart(2, '0')}.webp`;

  function show(i) {
    idx = Math.min(Math.max(i, 0), L.slides - 1);
    $('slideImg').src = slideSrc(idx);
    $('counter').textContent = `${AR(idx + 1)} / ${AR(L.slides)}`;
  }

  function render() {
    $('cnt').textContent = `(${AR(times.length)} / ${AR(L.slides)})`;
    $('tlist').innerHTML = times.map((t, i) => `
      <div class="trow ${i === idx ? 'cur' : ''}">
        <b>${AR(i + 1)}</b><span>${fmt(t)}</span>
        <button data-seek="${t}">استمع</button>
        ${i > 0 ? `<button data-del="${i}">حذف</button>` : ''}
      </div>`).join('');
    $('tlist').querySelectorAll('[data-seek]').forEach(b =>
      b.addEventListener('click', () => { audio.currentTime = +b.dataset.seek; audio.play(); }));
    $('tlist').querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', () => { times.splice(+b.dataset.del, 1); show(times.length - 1); render(); }));
    $('out').value = JSON.stringify(times.map(t => Math.round(t * 10) / 10));
  }

  function mark() {
    if (!audio.src || times.length >= L.slides) return;
    const t = audio.currentTime;
    if (t <= times[times.length - 1]) return;      /* يجب أن يكون تصاعديًّا */
    times.push(t);
    show(times.length - 1);
    render();
    $('markBtn').style.background = 'linear-gradient(140deg,#7fd18a,#3f9e52)';
    setTimeout(() => { $('markBtn').style.background = ''; }, 180);
  }

  $('markBtn').addEventListener('click', mark);
  $('undo').addEventListener('click', () => { if (times.length > 1) { times.pop(); show(times.length - 1); render(); } });
  $('reset').addEventListener('click', () => { times = [0]; show(0); render(); });

  $('autoSpread').addEventListener('click', () => {
    const d = audio.duration || L.duration;
    if (!d) return;
    times = Array.from({ length: L.slides }, (_, i) => Math.round((d * i / L.slides) * 10) / 10);
    show(0); render();
  });

  $('loadExisting').addEventListener('click', () => {
    fetch(`data/timings/lec${L.id}.json`).then(r => r.ok ? r.json() : null).then(j => {
      if (j && j.length) { times = j; show(0); render(); }
      else alert('لا يوجد ملف توقيت محفوظ لهذا المجلس بعد.');
    }).catch(() => alert('تعذّر التحميل.'));
  });

  $('copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('out').value); $('copy').textContent = 'تم النسخ ✓';
      setTimeout(() => $('copy').textContent = 'نسخ JSON', 1600); }
    catch { $('out').select(); document.execCommand('copy'); }
  });

  $('dl').addEventListener('click', () => {
    const blob = new Blob([$('out').value], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `lec${L.id}.json`; a.click();
    URL.revokeObjectURL(a.href);
  });

  /* المشغّل */
  $('playBtn').innerHTML = ICON_PLAY;
  $('playBtn').addEventListener('click', () => audio.paused ? audio.play() : audio.pause());
  audio.addEventListener('play', () => $('playBtn').innerHTML = ICON_PAUSE);
  audio.addEventListener('pause', () => $('playBtn').innerHTML = ICON_PLAY);
  audio.addEventListener('loadedmetadata', () => $('dur').textContent = fmt(audio.duration));
  audio.addEventListener('timeupdate', () => {
    $('cur').textContent = fmt(audio.currentTime);
    if (audio.duration) {
      const p = audio.currentTime / audio.duration * 100;
      $('fill').style.width = p + '%'; $('knob').style.insetInlineStart = p + '%';
    }
  });
  $('back10').addEventListener('click', () => audio.currentTime -= 10);
  $('fwd10').addEventListener('click', () => audio.currentTime += 10);
  $('speeds').addEventListener('click', e => {
    const b = e.target.closest('[data-rate]'); if (!b) return;
    audio.playbackRate = +b.dataset.rate;
    $('speeds').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
  });

  const bar = $('bar');
  bar.addEventListener('pointerdown', e => {
    const r = bar.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (r.right - e.clientX) / r.width));
    if (audio.duration) audio.currentTime = p * audio.duration;
  });

  document.addEventListener('keydown', e => {
    if (/input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key === 'm' || e.key === 'M' || e.key === 'ء') { e.preventDefault(); mark(); }
    else if (e.code === 'Space') { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
  });
})();
