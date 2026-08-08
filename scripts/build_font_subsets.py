#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "fonttools[woff]>=4.53",
#     "brotli",
# ]
# ///
"""Build the Japanese woff2 subsets vendored under ``docs/assets/vendor/fonts/``.

The report site is self-contained: no CDN, no webfont service. The Latin subsets
were vendored by hand; this script produces the Japanese ones for the translated
page, in the same body face the personal site uses (Zen Maru Gothic).

Only the body face is built. Headings, tables and cards are English on both
pages, so --font-display never has to resolve a Japanese character and its
Japanese counterpart there (Klee One) would be ~0.9 MB of dead weight. Adding a
Japanese heading means bringing Klee One back, here and in style.css.

The upstream fonts are not committed here (they are ~3-4 MB each). Fetch them
once from the Google Fonts repository, then point ``--src`` at that directory:

    base=https://raw.githubusercontent.com/google/fonts/main/ofl
    curl -O $base/zenmarugothic/ZenMaruGothic-{Regular,Medium,Bold}.ttf

Usage:
    ./scripts/build_font_subsets.py --src /path/to/source-fonts

Nothing here reaches the network.
"""

from __future__ import annotations

import argparse
import logging
import re
from pathlib import Path

from fontTools.subset import main as pyftsubset

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("build_font_subsets")

REPO = Path(__file__).resolve().parent.parent
OUT_DIR = REPO.joinpath("docs", "assets", "vendor", "fonts")
PAGES = (
    REPO.joinpath("docs", "index.html"),
    REPO.joinpath("docs", "ja", "index.html"),
)

# Stripped before collecting characters: none of it is rendered as body text.
MARKUP = re.compile(
    r"<script.*?</script>|<style.*?</style>|<svg.*?</svg>|<[^>]+>", re.S
)

# (source filename, output stem, weight)
FACES = (
    ("ZenMaruGothic-Regular.ttf", "zenmaru", "400"),
    ("ZenMaruGothic-Medium.ttf", "zenmaru", "500"),
    ("ZenMaruGothic-Bold.ttf", "zenmaru", "700"),
)


def jis_x0208(first_row: int, last_row: int) -> set[str]:
    """Characters in the given JIS X 0208 rows, via their EUC-JP encoding.

    Rows 1-8 are punctuation, kana, Greek and Cyrillic; rows 16-47 are the
    level-1 kanji.
    """
    chars = set()
    for row in range(first_row, last_row + 1):
        for cell in range(1, 95):
            try:
                chars.add(bytes([0xA0 + row, 0xA0 + cell]).decode("euc_jp"))
            except UnicodeDecodeError:
                continue
    return chars


def page_characters() -> set[str]:
    """Every character rendered as text across the report pages."""
    chars = set()
    for page in PAGES:
        chars |= set(MARKUP.sub(" ", page.read_text(encoding="utf-8")))
    return {c for c in chars if c.isprintable()}


def charset() -> set[str]:
    """The characters in use, plus enough of JIS X 0208 to absorb prose edits."""
    ascii_printable = {chr(c) for c in range(0x20, 0x7F)}
    kana_and_punctuation = {chr(c) for c in range(0x3000, 0x3100)}
    fullwidth_forms = {chr(c) for c in range(0xFF01, 0xFF60)}
    base = page_characters() | ascii_printable | kana_and_punctuation | fullwidth_forms
    return base | jis_x0208(1, 8) | jis_x0208(16, 47)


def build(src_dir: Path) -> None:
    chars = charset()
    total = 0
    for source, stem, weight in FACES:
        src = src_dir.joinpath(source)
        if not src.exists():
            raise SystemExit(
                f"source font not found: {src}\nSee this script's docstring."
            )
        out = OUT_DIR.joinpath(f"{stem}-{weight}-jp.woff2")
        pyftsubset(
            [
                str(src),
                "--text=" + "".join(sorted(chars)),
                "--flavor=woff2",
                # palt is applied to Japanese text in style.css; keep the rest of
                # the OpenType features rather than guessing which ones matter.
                "--layout-features=*",
                f"--output-file={out}",
            ]
        )
        size = out.stat().st_size
        total += size
        logger.info("%s  %d chars -> %.0f KB", out.name, len(chars), size / 1024)
    logger.info("total %.2f MB in %s", total / 1e6, OUT_DIR)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--src",
        type=Path,
        required=True,
        help="directory holding the upstream Zen Maru Gothic TTFs",
    )
    args = parser.parse_args()
    build(args.src.expanduser().resolve())


if __name__ == "__main__":
    main()
