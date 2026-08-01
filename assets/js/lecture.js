/* ===== صفحة المجلس: مشغّل + مزامنة الشرائح + الترجمة ===== */
(() => {
  const { AR, norm, normMap } = window.Arabic;
  const $ = id => document.getElementById(id);
  const QS = new URLSearchParams(location.search);
  const id = Math.max(1, parseInt(QS.get('id') || '1', 10));
  const startAt = Math.max(0, parseFloat(QS.get('t') || '0') || 0);

  const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6c0 .8.9 1.3 1.6.9l10.5-6.8a1 1 0 0 0 0-1.7L9.6 4.3A1 1 0 0 0 8 5.2Z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="4.5" width="4" height="15" rx="1.3"/><rect x="13.5" y="4.5" width="4" height="15" rx="1.3"/></svg>';
  const ICON_VOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z"/><path d="M15.5 9a4 4 0 0 1 0 6"/></svg>';
  const ICON_MUTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z"/><path d="M16 9.5l4 5m0-5l-4 5"/></svg>';

  const fmt = t => {
    if (!isFinite(t)) return '٠:٠٠';
    t = Math.max(0, Math.floor(t));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return AR(h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                : `${m}:${String(s).padStart(2, '0')}`);
  };

  const audio = $('audio');
  let L = null, slides = [], cues = [], timings = [], topics = [],
      idx = 0, userLocked = false, topicCur = -1;

  /* ---------- التحميل ---------- */
  const getCourse = () => window.COURSE
    ? Promise.resolve(window.COURSE)
    : fetch('data/course.json').then(r => r.json());

  getCourse().then(async data => {
    L = data.lectures.find(x => x.id === id) || data.lectures[0];
    document.title = `${L.title} — آيات الأحكام من سورة البقرة`;
    $('lecTitle').textContent = `المجلس ${AR(L.id)}: ${L.title}`;
    $('lecSub').textContent = L.subtitle + (L.date ? ` · ${L.date}` : '');

    slides = Array.from({ length: L.slides }, (_, i) =>
      `slides/${L.id}/${String(i + 1).padStart(2, '0')}.webp`);
    $('slideCount').textContent = `(${AR(L.slides)})`;
    buildThumbs();
    show(0);

    $('dlPdf').href = L.pdf;
    $('dlPdf').setAttribute('download', `المجلس-${L.id}.pdf`);

    if (L.audio) {
      /* Opus أصغر وأنقى، وMP3 احتياطي للمتصفحات القديمة — يختار المتصفح الأول المدعوم */
      const srcs = [];
      if (L.audioOpus) srcs.push(`<source src="${L.audioOpus}" type="audio/ogg; codecs=opus">`);
      srcs.push(`<source src="${L.audio}" type="audio/mpeg">`);
      audio.innerHTML = srcs.join('');
      audio.load();
      $('dlAudio').href = L.audio;
      $('dlAudio').setAttribute('download', `المجلس-${L.id}.mp3`);
      if (L.duration) $('dur').textContent = fmt(L.duration);
    } else {
      $('player').style.display = 'none';
      note('لا يتوفّر تسجيل صوتي لهذا المجلس؛ يمكنك تصفّح الشرائح وتحميل العرض بصيغة PDF.');
    }

    timings = (window.TIMINGS && window.TIMINGS[L.id])
              || await loadJSON(`data/timings/lec${L.id}.json`) || [];
    paintThumbTimes();
    if (timings.length) $('slideBox').classList.add('synced');
    else if (L.audio) note('مزامنة الشرائح لهذا المجلس لم تُضبط بعد؛ يمكنك التقليب بين الشرائح يدويًّا.');

    topics = (window.TOPICS && window.TOPICS[L.id])
             || await loadJSON(`data/topics/lec${L.id}.json`) || [];
    buildTopics();
    buildMarks();
    if (L.audio) $('nowbar').hidden = false;
    $('miniTitle').textContent = `المجلس ${AR(L.id)}`;

    cues = await loadVTT(`subs/lec${L.id}.vtt`);
    if (cues.length) {
      $('subs').classList.remove('empty');
      $('subs').textContent = '';
      buildTranscript();
    } else if (location.protocol === 'file:') {
      $('subs').textContent = 'التفريغ المتزامن يحتاج تشغيل الموقع عبر خادم محلي (شغّل serve.bat).';
    }

    if (L.audio) startPlayback();
  });

  /* يبدأ من رابط اللحظة، أو من حيث توقّف القارئ سابقًا */
  function startPlayback() {
    const saved = window.Store && Store.get(L.id);
    const at = startAt || (saved && saved.d && saved.t / saved.d < 0.97 ? saved.t : 0);
    const seek = () => { if (at > 0) try { audio.currentTime = at; } catch (e) {} };
    if (audio.readyState >= 1) seek();
    else audio.addEventListener('loadedmetadata', seek, { once: true });
    if (at > 0 && !startAt) toast(`تابعنا من حيث توقّفت — ${fmt(at)}`);
    tryAutoplay();
  }

  const loadJSON = url => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);

  /* ---------- WebVTT ---------- */
  async function loadVTT(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const txt = await res.text();
      const out = [];
      const toSec = t => {
        const p = t.trim().split(':').map(parseFloat);
        return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
      };
      txt.replace(/\r/g, '').split('\n\n').forEach(block => {
        const line = block.split('\n').find(l => l.includes('-->'));
        if (!line) return;
        const [a, b] = line.split('-->');
        const text = block.split('\n').slice(block.split('\n').indexOf(line) + 1).join(' ').trim();
        if (text) out.push({ s: toSec(a), e: toSec(b), t: text });
      });
      return out.sort((x, y) => x.s - y.s);
    } catch { return []; }
  }

  function note(html) {
    $('notice').innerHTML =
      `<div class="notice"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg><div>${html}</div></div>`;
  }

  /* ---------- الشرائح ---------- */
  function buildThumbs() {
    /* المصغّرة نسخة ٣٢٠ بكسل (~٩ ك.ب) لا الشريحة كاملة — أخفّ على الجوال */
    $('thumbs').innerHTML = slides.map((src, i) => `
      <button data-i="${i}" aria-label="الشريحة ${i + 1}">
        <i>${AR(i + 1)}</i>
        <figure><img src="${src.replace(/\/(\d+\.webp)$/, '/t/$1')}" loading="lazy"
                     width="320" height="180" alt=""><b class="tm" data-i="${i}"></b></figure>
      </button>`).join('');
    $('thumbs').querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => {
        const i = +b.dataset.i;
        show(i);
        if (userLocked || timings[i] == null || !audio.src) { lockUser(); return; }
        /* المزامنة مفعّلة: انقل الصوت، وإن رفض المتصفح القفز ابقَ على الشريحة */
        const want = timings[i];
        audio.currentTime = want;
        setTimeout(() => {
          if (Math.abs(audio.currentTime - want) > 3) { lockUser(); show(i); }
        }, 350);
      }));
  }

  function paintThumbTimes() {
    $('thumbs').querySelectorAll('.tm').forEach(el => {
      const t = timings[+el.dataset.i];
      el.textContent = t != null ? fmt(t) : '';
    });
  }

  function show(i) {
    if (i < 0 || i >= slides.length) return;
    idx = i;
    $('slideImg').src = slides[i];
    $('counter').textContent = `${AR(i + 1)} / ${AR(slides.length)}`;
    $('thumbs').querySelectorAll('button').forEach((b, k) => b.classList.toggle('active', k === i));
    const act = $('thumbs').querySelector('button.active');
    if (act) {                                  /* تمرير داخل اللوح فقط لا الصفحة */
      const box = $('thumbs');
      const top = act.offsetTop - box.offsetTop;
      if (top < box.scrollTop || top + act.offsetHeight > box.scrollTop + box.clientHeight)
        box.scrollTop = top - box.clientHeight / 2 + act.offsetHeight / 2;
    }
    // تحميل مسبق للشريحة التالية
    if (slides[i + 1]) { const im = new Image(); im.src = slides[i + 1]; }
  }

  /* ---------- فهرس المواضيع ---------- */
  function buildTopics() {
    const box = $('topics');
    if (!topics.length) {
      box.innerHTML = '<p class="side-empty">فهرس المواضيع غير متوفّر لهذا المجلس.</p>';
      $('topicCount').textContent = '';
      return;
    }
    $('topicCount').textContent = `(${AR(topics.length)})`;
    box.innerHTML = topics.map((tp, i) => `
      <button class="topic" data-i="${i}" data-t="${tp.t}">
        <time>${fmt(tp.t)}</time>
        <span><b>${esc(tp.title)}</b>${tp.sub ? `<em>${esc(tp.sub)}</em>` : ''}</span>
      </button>`).join('');
    box.addEventListener('click', e => {
      const b = e.target.closest('.topic'); if (!b) return;
      goTo(+b.dataset.t);
    });
  }

  function topicAt(t) {
    let lo = 0, hi = topics.length - 1, res = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (topics[mid].t <= t) { res = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return res;
  }

  function paintTopic(t) {
    const k = topicAt(t);
    if (k === topicCur) return;
    topicCur = k;
    $('topics').querySelectorAll('.topic').forEach((b, i) => b.classList.toggle('cur', i === k));
    $('nowTopic').textContent = k >= 0 ? topics[k].title : '';
    const act = $('topics').querySelector('.topic.cur');
    if (act && $('topics').offsetParent) {
      const box = $('topics'), top = act.offsetTop - box.offsetTop;
      if (top < box.scrollTop || top + act.offsetHeight > box.scrollTop + box.clientHeight)
        box.scrollTop = top - box.clientHeight / 2 + act.offsetHeight / 2;
    }
  }

  /* ---------- العلامات المرجعية ---------- */
  function buildMarks() {
    const list = window.Store ? Store.marks(L.id) : [];
    $('markCount').textContent = list.length ? `(${AR(list.length)})` : '';
    const box = $('marks');
    if (!list.length) {
      box.innerHTML = '<p class="side-empty">لا علامات بعد.<br>اضغط <b>🔖 علامة</b> أثناء الاستماع لتحفظ الموضع، أو مفتاح <b>M</b>.</p>';
      return;
    }
    box.innerHTML = list.map(m => `
      <div class="mark">
        <button class="mark-go" data-t="${m.t}"><time>${fmt(m.t)}</time>
          <span>${esc(m.n || (topics[topicAt(m.t)] || {}).title || 'علامة')}</span></button>
        <button class="mark-del" data-t="${m.t}" title="حذف العلامة" aria-label="حذف العلامة">✕</button>
      </div>`).join('');
  }

  $('marks').addEventListener('click', e => {
    const go = e.target.closest('.mark-go');
    if (go) { goTo(+go.dataset.t); return; }
    const del = e.target.closest('.mark-del');
    if (del) { Store.delMark(L.id, +del.dataset.t); buildMarks(); toast('حُذفت العلامة'); }
  });

  function addMark() {
    if (!window.Store || !L) return;
    const t = Math.floor(audio.currentTime);
    Store.addMark(L.id, t, (topics[topicAt(t)] || {}).title || '');
    buildMarks();
    switchTab('marks');
    toast(`وُضعت علامة عند ${fmt(t)}`);
  }

  /* ---------- التبويبات ---------- */
  function switchTab(which) {
    const map = { topics: ['tabTopics', 'topics'], slides: ['tabSlides', 'thumbs'], marks: ['tabMarks', 'marks'] };
    for (const k in map) {
      const on = k === which;
      $(map[k][0]).classList.toggle('on', on);
      $(map[k][0]).setAttribute('aria-selected', String(on));
      $(map[k][1]).hidden = !on;
    }
  }
  $('tabTopics').addEventListener('click', () => switchTab('topics'));
  $('tabSlides').addEventListener('click', () => switchTab('slides'));
  $('tabMarks').addEventListener('click', () => switchTab('marks'));

  /* ---------- الانتقال إلى لحظة ---------- */
  function goTo(t) {
    if (!audio.src && !audio.querySelector('source')) return;
    audio.currentTime = t;
    if (audio.paused) audio.play().catch(() => {});
    if (userLocked) unlockUser();
  }

  /* ---------- إشعار خفيف ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.classList.remove('on'); }, 2600);
  }

  /* ---------- التفريغ الكامل ---------- */
  let txRows = [], txCur = -1, subsOn = true;

  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function buildTranscript() {
    $('tx').hidden = false;
    $('txCount').textContent = `(${AR(cues.length)} مقطعًا)`;
    cues.forEach(c => { c._n = norm(c.t); });   /* نسخة مطبَّعة للبحث السريع */
    $('txBody').innerHTML = cues.map((c, i) =>
      `<button class="tx-line" data-i="${i}"><time>${fmt(c.s)}</time><p>${esc(c.t)}</p></button>`).join('');
    txRows = [...$('txBody').querySelectorAll('.tx-line')];
    $('txBody').addEventListener('click', e => {
      const b = e.target.closest('.tx-line'); if (!b) return;
      audio.currentTime = cues[+b.dataset.i].s;
      if (audio.paused) audio.play();
    });
  }

  $('txToggle').addEventListener('click', () => {
    const open = $('txBody').hidden;
    $('txBody').hidden = !open;
    $('txToggle').setAttribute('aria-expanded', String(open));
    if (open && txCur >= 0) scrollToCur();
  });

  /* ---------- البحث في التفريغ ----------
     يستعمل التطبيع العربي المشترك في assets/js/arabic.js: يتجاهل التشكيل
     والهمزات والتطويل — كي يجد «أصوّر» و«اصور» و«أَصور» سواء. */
  let txMatches = [], txHit = -1;

  function markRow(row, text, q) {
    const p = row.querySelector('p');
    const r = window.Arabic.highlight(text, q || '');
    p.innerHTML = r.html;
    return r.count;
  }

  function gotoHit(k) {
    if (!txMatches.length) return;
    txHit = (k + txMatches.length) % txMatches.length;
    txRows.forEach(r => r.classList.remove('tx-active'));
    const row = txRows[txMatches[txHit]];
    row.classList.add('tx-active');
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    $('txHits').textContent = `${AR(txHit + 1)} من ${AR(txMatches.length)}`;
  }

  function runSearch(q) {
    if ($('txBody').hidden && q) $('txToggle').click();
    const prev = txMatches;
    txMatches = []; txHit = -1;
    const nq = norm(q);
    let total = 0;
    /* المرور السريع على النص المطبَّع المحفوظ، ثم تمييز المطابق فقط */
    if (nq) cues.forEach((c, i) => { if (c._n.includes(nq)) txMatches.push(i); });
    prev.forEach(i => { if (!txMatches.includes(i)) markRow(txRows[i], cues[i].t, ''); });
    txRows.forEach(r => r.classList.remove('tx-active'));
    txMatches.forEach(i => { total += markRow(txRows[i], cues[i].t, q); });
    const old = $('txBody').querySelector('.tx-empty');
    if (old) old.remove();
    const show = !!q;
    $('txHits').hidden = $('txPrev').hidden = $('txNext').hidden = !show;
    if (!show) return;
    if (!txMatches.length) {
      $('txHits').textContent = 'لا نتائج';
      $('txBody').insertAdjacentHTML('afterbegin',
        '<p class="tx-empty">لا توجد نتائج. جرّب كلمة أقصر — البحث يتجاهل الهمزات والتشكيل تلقائيًّا.</p>');
      return;
    }
    $('txHits').title = `تكرّرت ${AR(total)} مرة في ${AR(txMatches.length)} موضعًا`;
    gotoHit(0);
  }

  let txTimer;
  $('txSearch').addEventListener('input', e => {
    clearTimeout(txTimer);
    const q = e.target.value.trim();
    txTimer = setTimeout(() => runSearch(q), 160);
  });
  $('txSearch').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (txMatches.length) gotoHit(txHit + (e.shiftKey ? -1 : 1));
    else runSearch(e.target.value.trim());
  });
  $('txNext').addEventListener('click', () => gotoHit(txHit + 1));
  $('txPrev').addEventListener('click', () => gotoHit(txHit - 1));

  function scrollToCur() {
    const row = txRows[txCur];
    if (row && !row.hidden) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  $('subsBtn').addEventListener('click', () => {
    subsOn = !subsOn;
    $('subsBtn').classList.toggle('on', subsOn);
    $('subs').style.display = subsOn ? '' : 'none';
  });

  /* التقليب اليدوي يعطّل المزامنة حتى يطلب المستخدم عودتها */
  function lockUser() {
    if (userLocked) return;
    userLocked = true;
    $('slideBox').classList.remove('synced');
    $('slideBox').classList.add('manual');
  }

  function unlockUser() {
    userLocked = false;
    $('slideBox').classList.remove('manual');
    if (timings.length) {
      $('slideBox').classList.add('synced');
      show(slideAt(audio.currentTime));
    }
  }

  $('prevBtn').addEventListener('click', () => { show(idx - 1); lockUser(); });
  $('nextBtn').addEventListener('click', () => { show(idx + 1); lockUser(); });
  $('resync').addEventListener('click', unlockUser);

  /* ---------- المزامنة على timeupdate ---------- */
  function slideAt(t) {
    let lo = 0, hi = timings.length - 1, res = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (timings[mid] <= t) { res = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return res;
  }

  audio.addEventListener('timeupdate', () => {
    const t = audio.currentTime;
    if (timings.length && !userLocked) {
      const want = slideAt(t);
      if (want !== idx) show(want);
    }
    if (cues.length) {
      let lo = 0, hi = cues.length - 1, k = -1;
      while (lo <= hi) {                       /* بحث ثنائي بدل المسح الكامل */
        const mid = (lo + hi) >> 1;
        if (cues[mid].s <= t) { k = mid; lo = mid + 1; } else hi = mid - 1;
      }
      const c = (k >= 0 && t <= cues[k].e) ? cues[k] : null;
      paintSubs(c, t);
      if (k !== txCur) {
        if (txRows[txCur]) txRows[txCur].classList.remove('cur');
        txCur = k;
        if (txRows[txCur]) {
          txRows[txCur].classList.add('cur');
          if (!$('txBody').hidden && !$('txSearch').value) scrollToCur();
        }
      }
    }
    if (topics.length) paintTopic(t);
    $('cur').textContent = fmt(t);
    $('miniTime').textContent = fmt(t);
    const d = audio.duration || L?.duration || 0;
    if (d) {
      const p = (t / d) * 100;
      $('fill').style.width = p + '%';
      $('knob').style.insetInlineStart = p + '%';
      $('miniFill').style.width = p + '%';
    }
    saveProgress(t, d);
  });

  /* ---------- حفظ التقدّم (مرة كل ٥ ثوانٍ) ---------- */
  let lastSave = 0;
  function saveProgress(t, d) {
    if (!window.Store || !L || !d) return;
    if (Math.abs(t - lastSave) < 5) return;
    lastSave = t;
    Store.save(L.id, t, d);
  }
  addEventListener('pagehide', () => {
    if (window.Store && L && audio.duration) Store.save(L.id, audio.currentTime, audio.duration);
  });

  /* ---------- التفريغ المتزامن + تظليل الكلمة ----------
     التوقيت على مستوى الجملة لا الكلمة، فنوزّع زمن الجملة على كلماتها
     بحسب أطوالها. تتبّعٌ مرئيّ مُعين، لا مطابقة دقيقة. */
  let wordOn = localStorage.getItem('wordHL') !== '0';
  let subsCue = null, subsWords = [], subsW = -1;

  function splitWords(text) {
    const parts = text.split(/(\s+)/);
    const words = [];
    let n = 0;
    parts.forEach(p => { if (p.trim()) n += p.trim().length; });
    let acc = 0;
    parts.forEach(p => {
      if (!p.trim()) { words.push({ w: p, sep: true }); return; }
      const share = p.trim().length / (n || 1);
      words.push({ w: p, sep: false, a: acc, b: acc + share });
      acc += share;
    });
    return words;
  }

  function paintSubs(c, t) {
    const box = $('subs');
    if (!c) {
      if (subsCue !== null) { box.textContent = ''; subsCue = null; subsWords = []; subsW = -1; }
      return;
    }
    if (c !== subsCue) {
      subsCue = c; subsW = -1;
      subsWords = splitWords(c.t);
      if (wordOn) {
        box.innerHTML = subsWords.map((o, i) =>
          o.sep ? esc(o.w) : `<span class="w" data-i="${i}">${esc(o.w)}</span>`).join('');
      } else {
        box.textContent = c.t;
      }
    }
    if (!wordOn) return;
    const span = Math.max(0.4, (c.e - c.s));
    const r = Math.min(1, Math.max(0, (t - c.s) / span));
    let k = -1;
    for (let i = 0; i < subsWords.length; i++) {
      const o = subsWords[i];
      if (!o.sep && r >= o.a && r < o.b) { k = i; break; }
    }
    if (k === subsW) return;
    if (subsW >= 0) { const p = box.querySelector(`.w[data-i="${subsW}"]`); if (p) p.classList.remove('on'); }
    subsW = k;
    if (k >= 0) { const n = box.querySelector(`.w[data-i="${k}"]`); if (n) n.classList.add('on'); }
  }

  $('wordBtn').addEventListener('click', () => {
    wordOn = !wordOn;
    localStorage.setItem('wordHL', wordOn ? '1' : '0');
    $('wordBtn').classList.toggle('on', wordOn);
    subsCue = null;                       /* أعِد رسم المقطع الحالي */
    toast(wordOn ? 'تظليل الكلمة مفعّل (تقريبي)' : 'أُطفئ تظليل الكلمة');
  });
  $('wordBtn').classList.toggle('on', wordOn);

  audio.addEventListener('loadedmetadata', () => { $('dur').textContent = fmt(audio.duration); });
  audio.addEventListener('progress', () => {
    if (audio.buffered.length && audio.duration)
      $('buf').style.width = (audio.buffered.end(audio.buffered.length - 1) / audio.duration) * 100 + '%';
  });
  audio.addEventListener('play', () => { $('playBtn').innerHTML = ICON_PAUSE; $('playBtn').setAttribute('aria-label', 'إيقاف مؤقت'); });
  audio.addEventListener('pause', () => { $('playBtn').innerHTML = ICON_PLAY; $('playBtn').setAttribute('aria-label', 'تشغيل'); });
  audio.addEventListener('ended', () => { $('playBtn').innerHTML = ICON_PLAY; });

  /* ---------- التشغيل التلقائي (يحترم سياسة المتصفح) ---------- */
  function tryAutoplay() {
    $('playBtn').innerHTML = ICON_PLAY;
    const p = audio.play();
    if (p && p.catch) p.catch(() => { /* المتصفح منع التشغيل التلقائي — ينتظر ضغطة المستخدم */ });
  }

  $('playBtn').addEventListener('click', () => audio.paused ? audio.play() : audio.pause());
  $('back15').addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 15); });
  $('fwd15').addEventListener('click', () => { audio.currentTime = Math.min(audio.duration || 1e9, audio.currentTime + 15); });

  /* السرعة */
  $('speeds').addEventListener('click', e => {
    const b = e.target.closest('[data-rate]'); if (!b) return;
    audio.playbackRate = parseFloat(b.dataset.rate);
    $('speeds').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
  });

  /* الصوت */
  const vol = $('vol');
  const paintVol = () => { $('muteBtn').innerHTML = (audio.muted || audio.volume === 0) ? ICON_MUTE : ICON_VOL; };
  vol.addEventListener('input', () => { audio.volume = +vol.value; audio.muted = false; paintVol(); });
  $('muteBtn').addEventListener('click', () => { audio.muted = !audio.muted; paintVol(); });
  paintVol();

  /* شريط التقدّم — سحب ولمس */
  const bar = $('bar');
  const seekTo = clientX => {
    const r = bar.getBoundingClientRect();
    let p = (r.right - clientX) / r.width;          /* RTL */
    p = Math.min(1, Math.max(0, p));
    const d = audio.duration || L?.duration || 0;
    if (d) audio.currentTime = p * d;
  };
  let dragging = false;
  bar.addEventListener('pointerdown', e => { dragging = true; bar.classList.add('dragging'); bar.setPointerCapture(e.pointerId); seekTo(e.clientX); });
  bar.addEventListener('pointermove', e => { if (dragging) seekTo(e.clientX); });
  bar.addEventListener('pointerup', e => { dragging = false; bar.classList.remove('dragging'); bar.releasePointerCapture(e.pointerId); });
  bar.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') audio.currentTime -= 5;
    else if (e.key === 'ArrowLeft') audio.currentTime += 5;
  });

  /* ---------- حجم خطّ التفريغ ---------- */
  const SIZES = [15.5, 16.5, 18, 20, 22];
  let sizeIx = Math.min(SIZES.length - 1,
                        Math.max(0, parseInt(localStorage.getItem('txSize') || '1', 10)));
  function applySize() {
    document.documentElement.style.setProperty('--tx-size', SIZES[sizeIx] + 'px');
    localStorage.setItem('txSize', String(sizeIx));
    $('fontDown').disabled = sizeIx === 0;
    $('fontUp').disabled = sizeIx === SIZES.length - 1;
  }
  $('fontUp').addEventListener('click', () => { sizeIx = Math.min(SIZES.length - 1, sizeIx + 1); applySize(); });
  $('fontDown').addEventListener('click', () => { sizeIx = Math.max(0, sizeIx - 1); applySize(); });
  applySize();

  /* ---------- رابط اللحظة ---------- */
  $('linkBtn').addEventListener('click', async () => {
    const t = Math.floor(audio.currentTime);
    const url = `${location.origin}${location.pathname}?id=${L.id}&t=${t}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(`نُسخ رابط اللحظة ${fmt(t)}`);
    } catch (e) {
      prompt('انسخ الرابط:', url);
    }
  });
  $('markBtn').addEventListener('click', addMark);

  /* ---------- عرض الشريحة ملء الشاشة ---------- */
  const lb = $('lightbox');
  function openLB() {
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    paintLB();
  }
  function closeLB() { lb.hidden = true; document.body.style.overflow = ''; }
  function paintLB() {
    $('lbImg').src = slides[idx];
    $('lbCount').textContent = `${AR(idx + 1)} / ${AR(slides.length)}`;
  }
  $('expandBtn').addEventListener('click', openLB);
  $('lbClose').addEventListener('click', closeLB);
  lb.addEventListener('click', e => { if (e.target === lb) closeLB(); });
  $('lbPrev').addEventListener('click', () => { show(idx - 1); lockUser(); paintLB(); });
  $('lbNext').addEventListener('click', () => { show(idx + 1); lockUser(); paintLB(); });

  /* ---------- المشغّل المصغّر (يظهر حين يغيب الأصلي) ---------- */
  $('miniPlay').addEventListener('click', () => audio.paused ? audio.play() : audio.pause());
  $('mini').addEventListener('click', e => {
    if (e.target.closest('#miniPlay')) return;
    $('player').scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  function paintMiniIcon() { $('miniPlay').innerHTML = audio.paused ? ICON_PLAY : ICON_PAUSE; }
  audio.addEventListener('play', paintMiniIcon);
  audio.addEventListener('pause', paintMiniIcon);
  paintMiniIcon();

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => {
      const show = !en.isIntersecting && L && L.audio && audio.currentTime > 0;
      $('mini').hidden = !show;
    }, { threshold: 0 }).observe($('player'));
  }

  /* ---------- اختصارات لوحة المفاتيح ---------- */
  document.addEventListener('keydown', e => {
    if (/input|textarea/i.test(e.target.tagName)) return;
    if (!lb.hidden) {
      if (e.key === 'Escape') { closeLB(); return; }
      if (e.key === 'ArrowRight') { show(idx - 1); lockUser(); paintLB(); return; }
      if (e.key === 'ArrowLeft') { show(idx + 1); lockUser(); paintLB(); return; }
    }
    if (e.code === 'Space') { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
    else if (e.key === 'ArrowRight') { show(idx - 1); lockUser(); }
    else if (e.key === 'ArrowLeft') { show(idx + 1); lockUser(); }
    else if (e.key === 'm' || e.key === 'M' || e.key === 'م') addMark();
    else if (e.key === 'f' || e.key === 'F' || e.key === 'ب') lb.hidden ? openLB() : closeLB();
    else if (e.key === '/') { e.preventDefault(); $('txSearch').focus(); }
  });

  window.__paintThumbTimes = paintThumbTimes;
})();
