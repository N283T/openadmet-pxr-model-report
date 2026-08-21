# Third-party licences — report

The report bundles its charting library and fonts rather than loading them from a
CDN, so that the page renders identically offline and does not hand a reader's IP
address to a third party. Each is redistributed under its own licence, reproduced
in full in this directory.

| Component | Files | Licence |
|---|---|---|
| Apache ECharts 5.5.1 | `../echarts.min.js` | Apache-2.0 — [licence](ECharts-Apache-2.0.txt), [NOTICE](ECharts-NOTICE.txt) |
| Zen Maru Gothic | `../fonts/zenmaru-*.woff2` | SIL OFL 1.1 — [licence](ZenMaruGothic-OFL-1.1.txt) |
| Outfit | `../fonts/outfit-latin.woff2`, `../fonts/outfit-latinext.woff2` | SIL OFL 1.1 — [licence](Outfit-OFL-1.1.txt) |
| PlemolJP | `../fonts/PlemolJP-Regular.woff2` | SIL OFL 1.1 — [licence](PlemolJP-OFL-1.1.txt) |

The three text faces are **subsets** of the upstream releases, cut down to the
characters the report actually uses by `scripts/build_font_subsets.py`. OFL 1.1
treats a subset as a Modified Version, which may be redistributed under the same
licence together with the notices above.

The slide deck under [`../../../slides/`](../../../slides/) bundles more than
this — 3Dmol.js and KaTeX as well — and carries
[its own list](../../../slides/assets/vendor/LICENSES/README.md).
