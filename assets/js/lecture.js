/* ===== صفحة المجلس: مشغّل + مزامنة الشرائح + الترجمة ===== */
(() => {
  const AR = s => String(s).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const $ = id => document.getElementById(id);
  const id = Math.max(1, parseInt(new URLSearchParams(location.search).get('id') || '1', 10));

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
  let L = null, slides = [], cues = [], timings = [], idx = 0, userLocked = false, lockTimer = null;

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

    cues = await loadVTT(`subs/lec${L.id}.vtt`);
    if (cues.length) {
      $('subs').classList.remove('empty');
      $('subs').textContent = '';
      buildTranscript();
    } else if (location.protocol === 'file:') {
      $('subs').textContent = 'التفريغ المتزامن يحتاج تشغيل الموقع عبر خادم محلي (شغّل serve.bat).';
    }

    if (L.audio) tryAutoplay();
  });

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
    $('thumbs').innerHTML = slides.map((src, i) => `
      <button data-i="${i}" aria-label="الشريحة ${i + 1}">
        <i>${AR(i + 1)}</i>
        <figure><img src="${src}" loading="lazy" alt=""><b class="tm" data-i="${i}"></b></figure>
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
     تطبيع عربي: تجاهل التشكيل والهمزات والتطويل، وتوحيد الألف المقصورة
     والتاء المربوطة، وضغط المسافات — كي يجد «أصوّر» و«اصور» و«أَصور» سواء.
     يُحافظ على خريطة موضعية بين النص المطبَّع والأصلي لتمييز المطابقة بدقّة. */
  const AR_DIAC = /[ً-ْٰـۖ-ۭ]/;   /* تشكيل + تطويل */

  function normMap(s) {
    let out = '', map = [];
    for (let i = 0; i < s.length; i++) {
      let c = s[i];
      if (AR_DIAC.test(c)) continue;                 /* يُحذف من المطابقة */
      if ('أإآٱٲٳا'.includes(c)) c = 'ا';
      else if (c === 'ى') c = 'ي';
      else if (c === 'ة') c = 'ه';
      else if (c === 'ؤ') c = 'و';
      else if (c === 'ئ') c = 'ي';
      else if (c === 'ء') continue;                  /* الهمزة المفردة تُتجاهل */
      else c = c.toLowerCase();
      if (c === ' ' && out.endsWith(' ')) continue;  /* ضغط المسافات */
      out += c; map.push(i);
    }
    return { n: out, map };
  }
  const norm = s => normMap(s).n;

  let txMatches = [], txHit = -1;

  function markRow(row, text, q) {
    const p = row.querySelector('p');
    if (!q) { p.innerHTML = esc(text); return 0; }
    const { n, map } = normMap(text), nq = norm(q);
    let html = '', last = 0, at = 0, count = 0;
    while (nq && (at = n.indexOf(nq, at)) !== -1) {
      const s = map[at], e = (map[at + nq.length - 1] ?? s) + 1;
      html += esc(text.slice(last, s)) + '<mark>' + esc(text.slice(s, e)) + '</mark>';
      last = e; at += nq.length; count++;
    }
    p.innerHTML = html + esc(text.slice(last));
    return count;
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
      const box = $('subs');
      const txt = c ? c.t : '';
      if (box.textContent !== txt) box.textContent = txt;
      if (k !== txCur) {
        if (txRows[txCur]) txRows[txCur].classList.remove('cur');
        txCur = k;
        if (txRows[txCur]) {
          txRows[txCur].classList.add('cur');
          if (!$('txBody').hidden && !$('txSearch').value) scrollToCur();
        }
      }
    }
    $('cur').textContent = fmt(t);
    const d = audio.duration || L?.duration || 0;
    if (d) {
      const p = (t / d) * 100;
      $('fill').style.width = p + '%';
      $('knob').style.insetInlineStart = p + '%';
    }
  });

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

  /* اختصارات لوحة المفاتيح */
  document.addEventListener('keydown', e => {
    if (/input|textarea/i.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
    else if (e.key === 'ArrowRight') { show(idx - 1); lockUser(); }
    else if (e.key === 'ArrowLeft') { show(idx + 1); lockUser(); }
  });

  window.__paintThumbTimes = paintThumbTimes;
})();
