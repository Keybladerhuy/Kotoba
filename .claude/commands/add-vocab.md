Add a vocabulary entry to `data/vocabulary.json` for the word: $ARGUMENTS

## Steps

1. **Read** `data/vocabulary.json` and search for an entry where `word` equals the argument.
2. **If found**: Report "Already exists" and display the current entry. Stop.
3. **If not found**: Look up the word and append a new entry with the following schema:

```json
{
  "word": "概念",
  "reading": "がいねん",
  "meanings": ["concept", "notion"],
  "pos": "",
  "example": { "ja": "", "en": "" }
}
```

## Field rules

- `word`: the Japanese word as written (kanji/kana)
- `reading`: full hiragana reading of the word
- `meanings`: array of concise English definitions
- `pos`: part of speech (e.g. `"noun"`, `"verb"`, `"adjective"`, `"adverb"`) — leave `""` if unknown
- `example.ja`: an example sentence in Japanese — leave `""` if none available
- `example.en`: English translation of the example sentence — leave `""` if none available

## Notes

- Maintain valid JSON — the file is a top-level array `[...]`
- Append the new entry at the end of the array
- Do not alter any existing entries
- If you are uncertain about the reading or meanings, state your best answer and flag it for the user to confirm
