Add a kanji entry to `data/kanji.json` for the character: $ARGUMENTS

## Steps

1. **Read** `data/kanji.json` and search for an entry where `character` equals the argument.
2. **If found**: Report "Already exists" and display the current entry. Stop.
3. **If not found**: Look up the kanji and append a new entry with the following schema:

```json
{
  "character": "覚",
  "readings": { "on": ["カク"], "kun": ["おぼ.える", "さ.める"] },
  "meanings": ["memorize", "learn", "remember"],
  "examples": ["感覚", "覚悟", "目覚める"]
}
```

## Field rules

- `character`: the single kanji character (string)
- `readings.on`: array of on-readings in katakana (use dot notation for okurigana if applicable)
- `readings.kun`: array of kun-readings in hiragana (use dot notation to mark where okurigana begins, e.g. `おぼ.える`)
- `meanings`: array of concise English meanings
- `examples`: array of 2–4 common compound words or expressions using this kanji

## Notes

- Maintain valid JSON — the file is a top-level array `[...]`
- Append the new entry at the end of the array
- Do not alter any existing entries
- If you are uncertain about readings or meanings, state your best answer and flag it for the user to confirm
