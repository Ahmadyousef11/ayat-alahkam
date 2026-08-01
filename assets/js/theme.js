/* تبديل الوضع الليلي / النهاري */
(function () {
  const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M20.5 14.4A8.5 8.5 0 1 1 9.6 3.5a7 7 0 0 0 10.9 10.9Z"/></svg>';

  function paint() {
    const dark = document.documentElement.dataset.theme === 'dark';
    document.querySelectorAll('#themeBtn').forEach(b => {
      b.innerHTML = dark ? SUN : MOON;
      b.setAttribute('title', dark ? 'الوضع النهاري' : 'الوضع الليلي');
    });
  }

  function toggle() {
    const dark = document.documentElement.dataset.theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    localStorage.setItem('theme', document.documentElement.dataset.theme);
    paint();
  }

  document.addEventListener('DOMContentLoaded', () => {
    paint();
    document.querySelectorAll('#themeBtn').forEach(b => b.addEventListener('click', toggle));
  });
})();
