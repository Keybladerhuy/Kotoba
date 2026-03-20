#!/usr/bin/env python3
"""
Import kanji from davidluzgouveia/kanji-data into data/kanji.json.

Usage:
  1. Download the raw kanji.json from:
       https://github.com/davidluzgouveia/kanji-data/blob/master/kanji.json
     Save it alongside this script as: scripts/kanji-data.json

  2. Run:
       python scripts/import_kanji.py

  Options:
    --jlpt 1 2       JLPT levels to import (default: 1 2 = N1+N2)
    --source PATH    Path to the source kanji-data.json (default: scripts/kanji-data.json)
    --output PATH    Path to write result (default: data/kanji.json)
    --dry-run        Print stats without writing
"""

import json
import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent

DEFAULT_SOURCE = SCRIPT_DIR / "kanji-data.json"
DEFAULT_OUTPUT = REPO_ROOT / "data" / "kanji.json"


def load_source(path: Path) -> dict:
    """Load the kanji-data source file. Keys are kanji characters."""
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_existing(path: Path) -> list:
    """Load existing kanji.json, returning empty list if file missing."""
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def map_entry(char: str, data: dict) -> dict:
    """Map a kanji-data entry to Kotoba's schema."""
    on = data.get("readings_on") or []
    kun = data.get("readings_kun") or []
    meanings = data.get("meanings") or []

    return {
        "character": char,
        "readings": {"on": on, "kun": kun},
        "meanings": meanings,
        "examples": [],
    }


def main():
    parser = argparse.ArgumentParser(description="Import kanji from kanji-data into kanji.json")
    parser.add_argument("--jlpt", nargs="+", type=int, default=[1, 2],
                        help="JLPT levels to import (e.g. --jlpt 1 2)")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE,
                        help="Path to source kanji-data.json")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT,
                        help="Path to output kanji.json")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print stats without writing output")
    args = parser.parse_args()

    if not args.source.exists():
        print(f"ERROR: Source file not found: {args.source}", file=sys.stderr)
        print("Download it from: https://github.com/davidluzgouveia/kanji-data/blob/master/kanji.json",
              file=sys.stderr)
        sys.exit(1)

    print(f"Loading source: {args.source}")
    source = load_source(args.source)

    print(f"Loading existing: {args.output}")
    existing = load_existing(args.output)
    existing_chars = {entry["character"] for entry in existing}

    target_levels = set(args.jlpt)
    print(f"Filtering to JLPT levels: {sorted(target_levels)}")

    new_entries = []
    skipped_duplicate = 0
    skipped_no_jlpt = 0

    for char, data in source.items():
        jlpt = data.get("jlpt_new")
        if jlpt not in target_levels:
            skipped_no_jlpt += 1
            continue
        if char in existing_chars:
            skipped_duplicate += 1
            continue
        new_entries.append(map_entry(char, data))
        existing_chars.add(char)

    merged = existing + new_entries

    print(f"\nResults:")
    print(f"  Existing entries:   {len(existing)}")
    print(f"  New entries added:  {len(new_entries)}")
    print(f"  Skipped (duplicate): {skipped_duplicate}")
    print(f"  Skipped (no JLPT match): {skipped_no_jlpt}")
    print(f"  Total output:       {len(merged)}")

    if args.dry_run:
        print("\n--dry-run: no file written.")
        return

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    print(f"\nWrote {len(merged)} entries to {args.output}")


if __name__ == "__main__":
    main()
