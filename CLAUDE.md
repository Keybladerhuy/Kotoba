# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

The app uses `fetch()` for JSON data, so it must be served over HTTP — opening `index.html` directly via `file://` will not work.

```bash
# Python (simplest)
python -m http.server 8080
# Then open http://localhost:8080

# Node.js alternative
npx serve .
```

There is no build step, no bundler, and no package manager.

## Architecture

Kotoba is a vanilla JS flashcard app for Japanese N1 study. Four scripts are loaded in order at the bottom of `index.html`:

| File | Role |
|------|------|
| `js/data.js` | `Data` module — fetches and caches `data/kanji.json` and `data/vocabulary.json` via `Promise.all` on startup |
| `js/progress.js` | `Progress` module — reads/writes study progress to `localStorage` under key `jp_progress`; tracks status (`new` → `learning` → `known`) and correct/incorrect counts per item |
| `js/flashcard.js` | `Flashcard` module — manages a single study session: card flip animation (CSS class `flipped`), keyboard shortcuts (Space/←/→), and grading |
| `js/app.js` | View router — boots the app, manages navigation between Home / Flashcard / Summary views by cloning `<template>` elements from `index.html` |

Views are defined as `<template>` tags in `index.html` (`tpl-home`, `tpl-flashcard`, `tpl-summary`) and injected into `<main id="view">` at runtime.

**Data flow:** `app.js` calls `Data.loadAll()` → calls `Flashcard.mount(mode, items, onComplete)` → `Flashcard` calls `Progress.recordResult(id, correct)` per card → `onComplete` callback triggers `showSummary()`.

## Data Files

Both files are arrays in `data/`. The unique ID for each item is `character` (kanji) or `word` (vocab). See `data/README.md` for the full JSON schema.

- `data/kanji.json` — kanji entries with `character`, `readings.on[]`, `readings.kun[]`, `meanings[]`, `examples[]`
- `data/vocabulary.json` — vocab entries with `word`, `reading`, `meanings[]`, `pos`, `example.ja/en`
- `data/davidluzgouveia-kanji.json` — external kanji dataset (reference only, not loaded by the app)

## Claude Code Skills

```
/add-kanji <character>   # Add a kanji entry to data/kanji.json
/add-vocab <word>        # Add a vocabulary entry to data/vocabulary.json
```

Both commands check for duplicates first and append at the end of the array.
