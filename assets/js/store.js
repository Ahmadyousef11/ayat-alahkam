/* ===== حفظ تقدّم الاستماع والعلامات المرجعية في المتصفح =====
   كل شيء محليّ على جهاز القارئ؛ لا يُرسل شيء إلى أي خادم. */
(function (w) {
  'use strict';

  const KEY = 'ayat.progress.v1';
  const BM = 'ayat.marks.v1';

  function read(k, d) {
    try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* وضع التصفّح الخاص */ }
  }

  const Store = {
    /* ---------- التقدّم ---------- */
    all() { return read(KEY, {}); },

    get(id) { return this.all()[id] || null; },

    save(id, t, dur) {
      if (!dur || t < 5) return;
      const a = this.all();
      a[id] = { t: Math.round(t), d: Math.round(dur), at: Date.now() };
      write(KEY, a);
    },

    /** نسبة الاستماع ٠–١٠٠ */
    pct(id) {
      const p = this.get(id);
      return p && p.d ? Math.min(100, Math.round(p.t / p.d * 100)) : 0;
    },

    /** آخر مجلس استُمع إليه ولم يكتمل */
    last() {
      const a = this.all();
      let best = null;
      for (const id in a) {
        const p = a[id];
        if (p.d && p.t / p.d > 0.97) continue;          /* اكتمل */
        if (!best || p.at > best.at) best = { id: +id, t: p.t, d: p.d, at: p.at };
      }
      return best;
    },

    /* ---------- العلامات المرجعية ---------- */
    marks(id) {
      const m = read(BM, {});
      return id === undefined ? m : (m[id] || []);
    },

    addMark(id, t, note) {
      const m = read(BM, {});
      const list = m[id] || [];
      if (list.some(x => Math.abs(x.t - t) < 3)) return list;
      list.push({ t: Math.round(t), n: note || '' });
      list.sort((a, b) => a.t - b.t);
      m[id] = list; write(BM, m);
      return list;
    },

    delMark(id, t) {
      const m = read(BM, {});
      m[id] = (m[id] || []).filter(x => x.t !== t);
      write(BM, m);
      return m[id];
    },

    countMarks() {
      const m = read(BM, {});
      return Object.keys(m).reduce((s, k) => s + m[k].length, 0);
    }
  };

  w.Store = Store;
})(window);
