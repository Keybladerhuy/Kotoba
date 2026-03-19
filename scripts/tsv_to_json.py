#!/usr/bin/env python3
"""
Convert vocab_raw.tsv to vocabulary.json matching the app schema.
"""

import json
import os
import re
import sys

TSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "vocab_raw.tsv")
JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "vocabulary.json")


def split_meanings(english):
    """Split English column on commas/semicolons into a list of meanings."""
    parts = re.split(r'[,;]', english)
    return [p.strip() for p in parts if p.strip()]


def main():
    if not os.path.exists(TSV_PATH):
        print(f"ERROR: TSV not found at {TSV_PATH}", file=sys.stderr)
        print("Run extract_pdf.py first.", file=sys.stderr)
        sys.exit(1)

    entries = []
    skipped = 0

    with open(TSV_PATH, encoding="utf-8") as f:
        header = f.readline()  # skip header line
        for lineno, line in enumerate(f, start=2):
            line = line.rstrip("\n")
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 3:
                skipped += 1
                continue
            kanji, hiragana, english = parts[0], parts[1], "\t".join(parts[2:])
            kanji = kanji.strip()
            hiragana = hiragana.strip()
            english = english.strip()

            if not kanji or not english:
                skipped += 1
                continue

            meanings = split_meanings(english)
            if not meanings:
                skipped += 1
                continue

            entries.append({
                "word": kanji,
                "reading": hiragana,
                "meanings": meanings,
                "pos": "",
                "example": {"ja": "", "en": ""}
            })

    print(f"Entries converted: {len(entries)}")
    if skipped:
        print(f"Rows skipped (malformed): {skipped}")

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)

    print(f"Written to: {JSON_PATH}")


if __name__ == "__main__":
    main()
