/**
 * data.js — Fetches and caches kanji.json + vocabulary.json
 */
const Data = (() => {
  let _kanji = null;
  let _vocab = null;

  async function _load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async function loadAll() {
    if (_kanji && _vocab) return;
    const [kanji, vocab] = await Promise.all([
      _load('data/kanji.json'),
      _load('data/vocabulary.json'),
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

  return { loadAll, getKanji, getVocab };
})();
