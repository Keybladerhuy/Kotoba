/**
 * data.js — Fetches and caches level-specific kanji + vocabulary data
 *
 * The current JLPT level is persisted to localStorage under 'jp_level'.
 * Call setLevel(level) to switch levels — this clears the cache so the
 * next loadAll() fetches the correct files.
 */
const Data = (() => {
  const LEVEL_KEY = 'jp_level';
  const VALID_LEVELS = ['n1', 'n2', 'n3', 'n4', 'n5'];

  let _kanji = null;
  let _vocab = null;
  let _level = localStorage.getItem(LEVEL_KEY) || 'n1';

  // Ensure stored value is valid
  if (!VALID_LEVELS.includes(_level)) _level = 'n1';

  async function _load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async function loadAll() {
    const [kanji, vocab] = await Promise.all([
      _load(`data/${_level}-kanji.json`),
      _load(`data/${_level}-vocabulary.json`),
    ]);
    _kanji = kanji;
    _vocab = vocab;
  }

  function getKanji() {
    if (!_kanji) throw new Error('Kanji data not loaded yet. Call loadAll() first.');
    return _kanji;
  }

  function getVocab() {
    if (!_vocab) throw new Error('Vocab data not loaded yet. Call loadAll() first.');
    return _vocab;
  }

  function getLevel() {
    return _level;
  }

  /** Switch levels. Clears the cache — caller must call loadAll() again. */
  function setLevel(level) {
    if (!VALID_LEVELS.includes(level)) return;
    _level = level;
    _kanji = null;
    _vocab = null;
    localStorage.setItem(LEVEL_KEY, level);
  }

  function getValidLevels() {
    return [...VALID_LEVELS];
  }

  return { loadAll, getKanji, getVocab, getLevel, setLevel, getValidLevels };
})();
