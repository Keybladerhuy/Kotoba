/**
 * srs-settings.js — Configurable SRS parameters
 *
 * All SRS tuning knobs live here. Values persist to localStorage
 * so users can tweak them from the settings panel.
 *
 * Storage key: jp_srs_settings
 */
const SrsSettings = (() => {
  const KEY = 'jp_srs_settings';

  const DEFAULTS = {
    // Session behavior
    repeatWrongCards: true,     // re-queue wrong cards within a session

    // Learning steps (days) — card must pass each step before graduating to full SRS
    // e.g. [1, 3] means: 1st correct → review in 1 day, 2nd correct → review in 3 days, then graduate
    learningSteps: [1, 3],

    // First full SRS interval after graduating from learning steps (days)
    graduateInterval: 6,

    // SM-2 ease factor
    defaultEase: 2.5,
    minEase: 1.3,
    easeBonus: 0.1,            // added to ease on correct
    easePenalty: 0.2,           // subtracted from ease on wrong

    // How many total correct answers to promote from "learning" to "known"
    knownThreshold: 3,
  };

  function _load() {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function _save(settings) {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }

  /** Get all settings (merged with defaults) */
  function getAll() {
    return _load();
  }

  /** Get a single setting by key */
  function get(key) {
    return _load()[key];
  }

  /** Update one or more settings */
  function set(updates) {
    const current = _load();
    Object.assign(current, updates);
    _save(current);
  }

  /** Reset all settings to defaults */
  function reset() {
    localStorage.removeItem(KEY);
  }

  /** Get the defaults (read-only) */
  function getDefaults() {
    return { ...DEFAULTS };
  }

  return { getAll, get, set, reset, getDefaults };
})();
