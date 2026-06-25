# OpenADMET PXR Challenge Model Report

## Description of the Model

This Track 1 Activity submission uses an ensemble-style regression model for
predicting PXR activity as pEC50. The final prediction is based on previously
validated activity models, with a small Phase 2 update that incorporates the
released Analog Set 1 labels while remaining anchored to the stronger Phase 1
submission scale.

The modeling workflow combines molecular descriptors, learned molecular
representations, and auxiliary activity-related signals. Candidate models were
trained with clustered cross-validation designed to reduce over-reliance on
near-duplicate analogs. Several model families and feature views were evaluated,
and the final submission uses a conservative blend rather than a single
newly-trained model.

The Phase 2 update retrains a strong activity model on the original labeled
training data plus the released Analog Set 1 labels. Predictions for the
still-blinded Analog Set 2 compounds are blended back toward the established
Phase 1 anchor to limit overfitting to the released subset.

A small high-activity correction was also applied to compounds prioritized by
an assay-level ranking model trained on public PXR activity data and related
auxiliary assay signals. This correction was kept deliberately modest and was
used only as a tail-adjustment diagnostic rather than as a replacement for the
main regression ensemble.

## Performance Comments

During Phase 1, leaderboard feedback and local validation indicated that the
model ranked compounds well but compressed the activity range: very weak
compounds tended to be predicted too high, while very strong compounds tended
to be predicted too low. After Analog Set 1 labels were released, this behavior
was confirmed on the unblinded subset.

The released Analog Set 1 labels were used as a diagnostic and Phase 2 training
resource, but not as a reason to make large post-hoc shifts. Local validation
showed that small improvements in cross-validation were not always reliable
for blinded analog subsets, so the final Phase 2 prediction keeps the update
modest, including only a limited high-activity tail adjustment, and preserves
the scale of the prior best-performing submission.

The model report here is intentionally high-level because final evaluation is
still pending. A fuller post-challenge report may include additional details on
feature construction, validation splits, ensemble weighting, and error analysis.

## Data and Training Notes

- The submission targets Track 1 Activity pEC50 prediction.
- The released Analog Set 1 labels were included in the Phase 2 training pool.
- Still-blinded Analog Set 2 compounds were not used as labeled training data.
- Model selection emphasized clustered validation, analog-subset diagnostics,
  and conservative changes from the previously validated prediction scale.

## Reproducibility Note

This public repository is a report-only artifact. Training code, raw
competition data, generated predictions, and experiment artifacts are not
included here.
