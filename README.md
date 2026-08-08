# OpenADMET PXR Challenge — Track 1 Activity Model Report

Technical report for a **4th-of-95** Track 1 Activity submission to the
[OpenADMET PXR Blind Challenge](https://huggingface.co/spaces/openadmet/pxr-challenge)
(blinded pEC50 prediction for PXR compounds, 2026-04-01 – 2026-07-01).

- 📊 **Interactive report:** <https://n283t.github.io/openadmet-pxr-model-report/> — source in [`docs/`](docs/)
- 🇯🇵 **Japanese version:** <https://n283t.github.io/openadmet-pxr-model-report/ja/> — source in [`docs/ja/`](docs/ja/)
- 📄 **Markdown report:** [MODEL_REPORT.md](MODEL_REPORT.md) (English only)

## The model

![Nine-member ensemble in three families: a tabular core of descriptors and predicted log2fc, frozen embeddings from encoders pretrained on log2fc, and pooled Boltz-2 trunk representations. Every member is read out by TabPFN, and Caruana forward selection turns them into one prediction.](docs/assets/img/model-overview.svg)

Members fall into three families by how their features are built, and the readout
is TabPFN in every case. The walkthrough is in [MODEL_REPORT.md](MODEL_REPORT.md).

## Results

Scores came out at three points. The live leaderboard moved with every
submission, so these three are the only standings that hold still afterwards.

| Standing | Test slice | Rank | MAE | RAE | R² | Spearman ρ | Kendall τ |
|---|---|---:|---:|---:|---:|---:|---:|
| Phase 1 final | AS1 (253) | 8 | 0.4071 | 0.5115 | 0.6783 | 0.8455 | 0.6566 |
| Interim | AS1 + AS2 (513) | 4 / 338 | 0.4059 | 0.5359 | 0.6496 | 0.8343 | 0.6459 |
| Phase 2 | AS2 (260) | 4 / 95 | 0.4113 | 0.5703 | 0.6008 | 0.8161 | 0.6225 |

MAE is the only ranked metric. Lower is better for MAE and RAE; higher is better
for R², Spearman ρ, and Kendall τ. The three rows use different test slices, so
their numbers are not directly comparable. Organizers' write-ups:
[Phase 1 results](https://openadmet.ghost.io/woah-were-halfway-there/) and the
[post-challenge wrap-up](https://openadmet.ghost.io/its-the-end-of-the-pxr-challenge-as-we-know-it-and-i-feel-fine/).
