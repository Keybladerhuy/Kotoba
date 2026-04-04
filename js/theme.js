/**
 * theme.js — Dark/light theme toggle with localStorage persistence
 *
 * Stores preference under key `jp_theme`. Applies `data-theme` attribute
 * on <html> so all CSS variables switch via a single selector.
 */
const Theme = (() => {
  const KEY = 'jp_theme';
  const DARK = 'dark';
  const LIGHT = 'light';

  function _get() {
    return localStorage.getItem(KEY) || DARK;
  }

  function _apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('theme-icon');
    if (icon) icon.innerHTML = theme === DARK ? '&#9790;' : '&#9728;';
  }

  function init() {
    const theme = _get();
    _apply(theme);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', toggle);
    }
  }

  function toggle() {
    const next = _get() === DARK ? LIGHT : DARK;
    localStorage.setItem(KEY, next);
    _apply(next);
  }

  function current() {
    return _get();
  }

  return { init, toggle, current };
})();
