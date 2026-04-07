# Data Directory

Place your Japanese study data files here. The app fetches both files on startup.

---

## kanji.json

Array of kanji objects with the following schema:

```json
[
  {
    "character": "憂",
    "readings": {
      "on": ["ユウ"],
      "kun": ["うれ.える", "うれ.い"]
    },
    "meanings": ["melancholy", "grief"],
    "compounds": [
      { "word": "憂鬱", "meaning": "depression; melancholy" },
      { "word": "憂慮", "meaning": "concern; anxiety" }
    ]
  }
]
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `character` | string | ✓ | The kanji character (used as unique ID) |
| `readings.on` | string[] | ✓ | On-yomi readings (can be empty array) |
| `readings.kun` | string[] | ✓ | Kun-yomi readings (can be empty array) |
| `meanings` | string[] | ✓ | English meanings |
| `compounds` | object[] | | Compound words using this kanji — each entry is `{ word, meaning }` (plain strings also accepted for backwards compatibility) |

---

## vocabulary.json

Array of vocabulary objects with the following schema:

```json
[
  {
    "word": "憂鬱",
    "reading": "ゆううつ",
    "meanings": ["depression", "melancholy"],
    "pos": "noun",
    "example": {
      "ja": "憂鬱な気分だ。",
      "en": "I feel depressed."
    }
  }
]
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `word` | string | ✓ | The vocabulary word (used as unique ID) |
| `reading` | string | ✓ | Hiragana/katakana reading |
| `meanings` | string[] | ✓ | English meanings |
| `pos` | string | | Part of speech (noun, verb, adj-i, adj-na, adv…) |
| `example.ja` | string | | Example sentence in Japanese |
| `example.en` | string | | Example sentence in English |

---

## How to Run

JSON `fetch()` requires a local server (cannot use `file://` directly).

```bash
# Python (pre-installed on most systems)
python -m http.server 8080
# Then open http://localhost:8080

# Node.js
npx serve .
# Then open http://localhost:3000
```

---

## Claude Code Skills

These slash commands are available in Claude Code for maintaining the data files.

### `/add-kanji <character>`

Adds a new kanji entry to `kanji.json`.

- Checks for an existing entry first — reports "already exists" if found
- Looks up on-readings, kun-readings, meanings, and example words
- Appends a correctly-shaped entry if the kanji is new

**Usage:** `/add-kanji 覚`

### `/add-vocab <word>`

Adds a new vocabulary entry to `vocabulary.json`.

- Checks for an existing entry first — reports "already exists" if found
- Appends a correctly-shaped entry with reading, meanings, pos, and example fields

**Usage:** `/add-vocab 概念`
