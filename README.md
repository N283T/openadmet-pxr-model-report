# OpenADMET PXR Challenge — Track 1 Activity Model Report

Technical report for a **4th-of-95** Track 1 Activity submission to the
[OpenADMET PXR Blind Challenge](https://huggingface.co/spaces/openadmet/pxr-challenge)
(blinded pEC50 prediction for PXR compounds, 2026-04-01 – 2026-07-01).

- 📊 **Interactive report (GitHub Pages):** published from [`docs/`](docs/)
- 📄 **Markdown report:** [MODEL_REPORT.md](MODEL_REPORT.md)

## Results

| Phase | Rank | MAE | RAE | R² | Spearman ρ | Kendall τ |
|---|---:|---:|---:|---:|---:|---:|
| Phase 1 | 4 | 0.4059 | 0.5359 | 0.6496 | 0.8343 | 0.6459 |
| Phase 2 | 4 | 0.4113 | 0.5703 | 0.6008 | 0.8161 | 0.6225 |

## What is here

```text
MODEL_REPORT.md            full post-challenge technical report
docs/                      GitHub Pages site (interactive charts)
  index.html               the report, with 7 charts from real data
  assets/css, assets/js    styling and ECharts rendering
  assets/vendor            vendored ECharts (self-contained, no CDN)
  assets/data/*.json       aggregated chart data
scripts/build_report_data.py   regenerates docs/assets/data from the working repo
```

## Regenerating chart data

The JSON under `docs/assets/data/` is derived from the private challenge working
repository. To rebuild it:

```bash
./scripts/build_report_data.py --src /path/to/pxr-iduction-challenge
```

The script uses [PEP 723](https://peps.python.org/pep-0723/) inline dependencies
and runs under [uv](https://docs.astral.sh/uv/). It reads nothing from the
network.

## Scope

This public repository is a **report-only artifact**. Raw competition data,
model checkpoints, feature matrices, and full prediction pools are intentionally
not included. Day-by-day experiment logs (including null results and wrong
turns, some in Japanese) live in the working-repo issues
[#100](https://github.com/N283T/pxr-iduction-challenge/issues/100) (Phase 1) and
[#208](https://github.com/N283T/pxr-iduction-challenge/issues/208) (Phase 2).
