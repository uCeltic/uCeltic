"""Demo: run parse + text_extract on a fixture and print human-friendly output."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path("/home/jamie/uCeltic/backend").resolve()))

from apps.tei.services.parse import parse_tei
from apps.tei.services.text_extract import extract_text_and_anchors


def main():
    fixture = Path(
        "/home/jamie/uCeltic/backend/apps/tei/tests/fixtures/serafin07.xml"
    )
    xml_bytes = fixture.read_bytes()

    tree = parse_tei(xml_bytes)
    print(tree)
    plain_text, anchors = extract_text_and_anchors(tree)

    print("=" * 70)
    print(f"FIXTURE: {fixture.name}  ({len(xml_bytes)} bytes XML)")
    print("=" * 70)
    print(f"plain_text: {len(plain_text)} chars")
    print(f"anchors:    {len(anchors)} entries")
    print()

    print("─" * 70)
    print("FIRST 400 CHARS OF plain_text")
    print("─" * 70)
    print(repr(plain_text[:400]))
    print()
    print("(rendered)")
    print(plain_text[:400])
    print()

    print("─" * 70)
    print("FIRST 15 ANCHORS")
    print("─" * 70)
    for a in anchors[:15]:
        snippet = plain_text[a["text_start"] : a["text_end"]]
        if len(snippet) > 60:
            snippet = snippet[:57] + "..."
        attrs_str = ""
        if a["attrs"]:
            shown = {k: v for k, v in list(a["attrs"].items())[:2]}
            attrs_str = f" attrs={shown}"
        line_str = f" line={a['line_no']}" if a["line_no"] else ""
        print(
            f"  id={a['id']:<3} tag={a['tag']:<14} "
            f"[{a['text_start']:>5}, {a['text_end']:>5}){line_str}{attrs_str}"
        )
        print(f"      → {snippet!r}")
    print()

    print("─" * 70)
    print("DEMO SEARCH: pretend Levenshtein matched 'Aoife' equivalent")
    print("─" * 70)
    needle = "Mikołaj"
    found = plain_text.find(needle)
    if found >= 0:
        print(f"naïve hit at char {found}..{found + len(needle)}: "
              f"{plain_text[found:found + len(needle)]!r}")

        hits = [
            a for a in anchors
            if a["text_start"] <= found < a["text_end"]
        ]
        print(f"\n  → match falls inside {len(hits)} nested anchors:")
        for a in hits:
            print(f"     anchor id={a['id']} tag={a['tag']:<10} "
                  f"[{a['text_start']}, {a['text_end']})")

        deepest = max(hits, key=lambda a: a["text_start"])
        print(f"\n  → deepest (most specific) anchor: id={deepest['id']} "
              f"tag={deepest['tag']}")

        outermost = min(hits, key=lambda a: a["text_start"])
        print(f"  → outermost (best for scroll target): id={outermost['id']} "
              f"tag={outermost['tag']}")
    else:
        print(f"  not found")

    print()
    print("─" * 70)
    print("LAST 5 ANCHORS")
    print("─" * 70)
    for a in anchors[-5:]:
        snippet = plain_text[a["text_start"] : a["text_end"]]
        if len(snippet) > 60:
            snippet = snippet[:57] + "..."
        print(f"  id={a['id']} tag={a['tag']:<12} "
              f"[{a['text_start']}, {a['text_end']})  → {snippet!r}")


if __name__ == "__main__":
    main()
