/* ===== أدوات عربية مشتركة بين صفحات الموقع =====
   التطبيع: تجاهل التشكيل والتطويل، وتوحيد الهمزات والتاء المربوطة
   والألف المقصورة — كي يجد البحثُ «أصوّر» و«اصور» و«أَصور» سواء. */
(function (w) {
  'use strict';

  const DIAC = /[ً-ْٰـۖ-ࣰۭ-ࣿ]/;

  /** يعيد {n: النص المطبَّع, map: موضع كل حرف في الأصل} */
  function normMap(s) {
    let out = '';
    const map = [];
    for (let i = 0; i < s.length; i++) {
      let c = s[i];
      if (DIAC.test(c)) continue;
      if ('أإآٱٲٳا'.indexOf(c) !== -1) c = 'ا';
      else if (c === 'ى') c = 'ي';
      else if (c === 'ة') c = 'ه';
      else if (c === 'ؤ') c = 'و';
      else if (c === 'ئ') c = 'ي';
      else if (c === 'ء') continue;
      else if ('﴿﴾[]()«»"‘’'.indexOf(c) !== -1) c = ' ';
      else c = c.toLowerCase();
      if (c === ' ' && (out === '' || out.endsWith(' '))) continue;
      out += c;
      map.push(i);
    }
    return { n: out, map: map };
  }

  const norm = s => normMap(s).n;

  /** أرقام عربية-هندية */
  const AR = s => String(s).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

  /** ث → م:ث أو س:م:ث */
  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return AR(h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                : `${m}:${String(s).padStart(2, '0')}`);
  }

  const esc = s => String(s).replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** يميّز مواضع الاستعلام داخل النص ويعيد HTML آمنًا. يعيد '' إن لم يطابق. */
  function highlight(text, q, cls) {
    const nq = norm(q);
    if (!nq) return { html: esc(text), count: 0 };
    const { n, map } = normMap(text);
    let html = '', last = 0, at = 0, count = 0;
    const tag = cls ? `<mark class="${cls}">` : '<mark>';
    while ((at = n.indexOf(nq, at)) !== -1) {
      const s = map[at], e = (map[at + nq.length - 1] !== undefined
                             ? map[at + nq.length - 1] : s) + 1;
      html += esc(text.slice(last, s)) + tag + esc(text.slice(s, e)) + '</mark>';
      last = e; at += nq.length; count++;
    }
    return { html: html + esc(text.slice(last)), count: count };
  }

  w.Arabic = { norm, normMap, AR, fmt, esc, highlight };
})(window);
