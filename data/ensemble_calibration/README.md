# Raw vs calibrated ensemble, on the unblinded test

Reproduced 2026-08-07 with the final ensemble weights, so both columns come from
one run rather than from two points in the submission history. That is what makes
these files worth vendoring: everywhere else, "before and after calibration"
means two different submissions with other changes in between.

- `ens_current_raw_calibrated_test_20260807.csv` — one row per test compound:
  `split` (AS1 / AS2), `raw`, `calibrated`, `test` (the true pEC50).
- `ens_current_raw_vs_calibrated_metrics_20260807.csv` — MAE / RAE / R2 /
  Spearman / Kendall / bias / RMSE for each, over AS1, AS2 and both.

`scripts/build_report_data.py` reads the per-compound file into
`docs/assets/data/calibration_effect.json`.

Spearman is identical between raw and calibrated by construction: the correction
is a positive-slope affine, so it cannot reorder anything. The builder checks
this and stops if it ever stops being true.
