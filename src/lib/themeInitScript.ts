/**
 * รันก่อน React hydrate — ตั้ง class="dark" จาก localStorage / system
 * เพื่อไม่ให้ navbar และพื้นหลังกระพริบธีมตอนรีเฟรช
 */
export const THEME_STORAGE_KEY = 'psu-theme';

export const themeInitScript = `(function(){
  try {
    var key = '${THEME_STORAGE_KEY}';
    var stored = localStorage.getItem(key);
    var theme = stored || 'system';
    var preferDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = theme === 'dark' || (theme === 'system' && preferDark);
    var root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (dark) root.classList.add('dark');
    root.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();`;
