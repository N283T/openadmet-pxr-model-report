# Third-party licences — slide deck

The deck bundles its libraries and fonts rather than loading them from a CDN, so
that it runs with no network at all. Each is redistributed under its own licence,
reproduced in full in this directory.

| Component | Files | Licence |
|---|---|---|
| Apache ECharts 5.5.1 | `../echarts.min.js` | Apache-2.0 — [licence](ECharts-Apache-2.0.txt), [NOTICE](ECharts-NOTICE.txt) |
| 3Dmol.js | `../3Dmol-min.js` | BSD-3-Clause — [licence](3Dmol.js-BSD-3-Clause.txt) |
| KaTeX 0.18.1 | `../katex/katex.min.js`, `../katex/katex.min.css` | MIT — [licence](KaTeX-MIT.txt) |
| KaTeX fonts | `../katex/fonts/*.woff2` | MIT, covered by the KaTeX licence above |
| Zen Maru Gothic | `../fonts/zenmaru-400.woff2`, `../fonts/zenmaru-700.woff2` | SIL OFL 1.1 — [licence](ZenMaruGothic-OFL-1.1.txt) |
| Outfit | `../fonts/outfit-var.woff2` | SIL OFL 1.1 — [licence](Outfit-OFL-1.1.txt) |
| PlemolJP | `../fonts/plemoljp-400.woff2`, `../fonts/plemoljp-700.woff2` | SIL OFL 1.1 — [licence](PlemolJP-OFL-1.1.txt) |

The 3Dmol.js licence file also carries the notices for GLmol, Three.js and
jQuery, whose code it incorporates.

The three text faces are **subsets** of the upstream releases, cut down to the
characters the slides actually use by `scripts/build_fonts.py` in the deck's
authoring repository. OFL 1.1 treats a subset as a Modified Version, which may be
redistributed under the same licence together with the notices above.

Figures credited to their source on the slide itself — the assay diagram and the
challenge logo — are **not** covered by anything here.
