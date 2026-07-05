# OpenADMET PXR Challenge — Track 1 Activity Model Report

Post-challenge technical report for the Track 1 Activity submission to the
OpenADMET PXR Blind Challenge (2026-04-01 – 2026-07-01). The task was to predict
PXR reporter activity (pEC50) for a blinded set of 513 compounds. The primary
metric was mean absolute error (MAE).

An interactive version of this report with charts is published via GitHub Pages
from the [`docs/`](docs/) directory.

## Final Results

| Phase | Rank | MAE | RAE | R² | Spearman ρ | Kendall τ |
|---|---:|---:|---:|---:|---:|---:|
| Phase 1 | 4 | 0.4059 | 0.5359 | 0.6496 | 0.8343 | 0.6459 |
| Phase 2 | 4 | 0.4113 | 0.5703 | 0.6008 | 0.8161 | 0.6225 |

Both phases finished **4th of 95** graded competitors. The final Phase 2 MAE
(0.4113) trailed the winner (0.4061) by ~0.005 pEC50 units and sat inside the
top statistical significance tier.

## 1. Task and Data

- **Target:** PXR activation pEC50 (higher = more potent inducer).
- **Training set:** 4,140 labeled compounds.
- **Blinded test set:** 513 compounds, delivered in two waves:
  - **Analog Set 1 (AS1)** — 253 compounds, labels released at the start of
    Phase 2 and used for answer-checks and validation design.
  - **Analog Set 2 (AS2)** — 260 compounds, blinded throughout.
- **Auxiliary assays:** a PXR counter-screen (`counter_pec50`, `counter_emax`)
  and a single-concentration high-throughput screen (log2 fold-change of the
  PXR reporter at two concentrations). These low-fidelity signals turned out to
  be central to the modeling recipe (Section 3).

The test compounds are synthetic **analogs expanded from training hits**, so
random cross-validation is optimistic — held-out random folds contain near
neighbors of their training rows. Every validation and calibration decision in
this project is built around that fact.

## 2. Feature Families

The final production feature matrix, `cheme_2d_full_boltz_log2fc_pred`
(~2,103 dimensions), concatenates several complementary families.

### 2.1 Classical 2D descriptors and fingerprints
- **RDKit descriptors** — a curated 41-column set plus the full 217-descriptor
  set.
- **Mordred** descriptors.
- **Jazzy** hydration / hydrogen-bond free-energy features (6 columns).
- **Fingerprints** available in the feature registry: Morgan/ECFP (r2, r3,
  count variants), feature-Morgan (FCFP), MACCS (167), atom-pair,
  topological-torsion, RDKit daylight-like, Avalon, and ErG (315-dim reduced-
  graph pharmacophore).

### 2.2 Auxiliary low-fidelity activity — the decisive signal
The single-concentration screen provides per-compound **log2 fold-change**
features (`log2fc` at 8.25 µM and 33 µM, plus stderr / Cohen's d / p-value).
Beyond using these directly, a ChemProp encoder was **pretrained to predict
log2fc** and its per-compound prediction added back as two scalar features.
These two "predicted log2fc" scalars are by far the most influential features
in the final model (Section 9).

### 2.3 Foundation-model embeddings
Several pretrained chemical representations were computed and probed:
- **CheMeleon** — a ChemProp-MPNN descriptor foundation model (~300-dim),
  used heavily as a decorrelating tabular feature family.
- **MoLFormer** (`ibm/MoLFormer-XL-both-10pct`), used as a frozen encoder.
- **ChemBERTa** variants (DeepChem 77M/100M/10M/5M, MLM & MTR).
- **ChemFM** (1B / 3B causal SMILES language models), mean-pooled.
- Graph-transformer encoders (KERMT / GROVER-style).

### 2.4 Boltz-2 structural features
Boltz-2 was run against human PXR (UniProt O75469, 434 residues) for ~4,650
compounds. Three distinct Boltz feature families were derived:
1. **Pose / confidence / affinity scalars** — the affinity head
   (`affinity_pred_value`, binder probability), confidence metrics (pTM, ipTM,
   ligand-ipTM, complex pLDDT / PDE), and geometry (ligand atom count,
   ligand-to-pocket distance).
2. **Re-aggregated pocket confidence features** — per-token pLDDT and
   token-pair PAE/PDE re-pooled over protein-all, ligand-all, a set of 13
   core-pocket residues, and the protein–ligand interface.
3. **Pooled trunk embeddings** (1,024-dim): mean PXR-residue, mean ligand-atom,
   and mean/max interface-pair representations from the Boltz trunk. Two
   production TabPFN members use these (core-pocket and all-pairs poolings).

## 3. Modeling Recipe

The central recipe is a **low-fidelity-pretrain → freeze → frozen-embedding →
TabPFN** pipeline (a "strategy-3" transfer-learning pattern):

1. Pretrain a chemical encoder on the abundant auxiliary `log2fc` signal.
2. Freeze it and extract one fixed vector per compound.
3. Train a downstream pEC50 regressor — almost always **TabPFN** — on that
   embedding (optionally concatenated with the tabular families above).

**Downstream learner: TabPFN.** TabPFN (v2.6 and v3) was the workhorse. Because
it degrades on very wide inputs, a **per-fold LightGBM-gain top-500 feature
selection** was applied inside each CV fold (leak-free) before fitting TabPFN.
This "compress then TabPFN" trick produced the first sub-0.40 single-model
out-of-fold MAE.

**Production ensemble members** (~9–10, single-model AS1 MAE in parentheses):

| Member | Encoder / features | AS1 MAE |
|---|---|---:|
| CheMeleon + 2D + Boltz, top-500 (TabPFN) | 2,103d → LGBM top-500 | 0.447 |
| CheMeleon + 2D + Boltz, full (TabPFN) | 2,103d full | 0.438 |
| ChemProp D-MPNN log2fc embed | frozen 256d | 0.444 |
| KERMT graph-transformer embed | frozen 3,200d | 0.455 |
| Boltz-2 trunk (core pocket) | pooled 1,024d | 0.488 |
| MoLFormer-c3 embed | frozen transformer | 0.506 |
| Boltz-2 trunk (all pairs) | pooled 1,024d | 0.490 |
| GatedGCN log2fc embed | PyG ResGatedGraphConv | 0.480 |
| AttentiveFP log2fc embed | PyG AttentiveFP | 0.491 |

Direct pEC50 neural fine-tuning (MoLFormer-XL LoRA; direct GIN / GraphGPS /
AttentiveFP / GatedGCN) consistently underperformed the frozen-embedding
recipe, so those backbones were kept **only** when wrapped in the
pretrain-embed → TabPFN pattern.

## 4. Validation Strategy

**Canonical CV — the UMAP split.** Morgan fingerprints are projected with UMAP
(10 components, Jaccard metric, 30 neighbors, seed 42), clustered into 50
KMeans clusters, and whole clusters are greedily distributed across 5 folds so
that **no chemical cluster spans train and validation**. This is the strictest
separation available and is the default for every production member, the
ensemble-weight optimization, and the calibration nested-CV.

**Diagnostic-only alternative splits** were built to mimic how the organizers
generated the analog test set:
- **analog-aware** — keep 46 potent seeds in train, route their Tanimoto
  neighbors (≥ 0.25) into validation.
- **mixed analog/diversity** — a full-coverage stratified variant.
- **test-NN** — stratify by each train compound's similarity to the actual 513
  test SMILES (labels never read).
- **adversarial** — a train-vs-test LightGBM classifier surfaces the
  "test-like" stratum.

A key lesson: models tuned on the UMAP split beat analog-tuned models on the
public leaderboard **despite** the analog-tuned models having lower out-of-fold
error. Analog splits therefore stayed diagnostic, and UMAP remained canonical.

## 5. Ensembling — Caruana Selection

Members pass an explicit, hand-audited allow-list (every member must have
out-of-fold RAE < 0.68; a new member is rejected if its residual correlation to
any existing member exceeds 0.85).

Weights come from **bagged Caruana forward selection** (`caruana_bag20`):
Caruana-2004 forward stepwise selection with replacement, sorted
initialization, run over 20 bags of half the members; the final weight of each
member is its normalized selection count across bags. Because weights are
discrete selection counts, no single member can dominate (~0.3 weight cap),
which structurally dampens the out-of-fold-vs-leaderboard gap that plagued
correlated strong members.

Continuous weight optimizers (Nelder-Mead, L2-regularized, per-fold) were
computed but **deliberately distrusted**: they repeatedly found impressive
out-of-fold gains that moved public-leaderboard predictions in the wrong
direction. Representative final Caruana weights concentrated ~0.60 on the
CheMeleon family, with small structural (Boltz) and diversity (AttentiveFP,
GatedGCN) contributions. The ensemble's AS1 MAE (~0.407) beats every single
member.

## 6. Calibration and Tail Correction

**Post-hoc calibration** fits an order-preserving map on the ensemble's
out-of-fold predictions using honest 5-fold UMAP nested CV. Candidate maps:
linear, non-negative-slope affine, monotone 5-knot spline, isotonic. Selection
rule: minimize MAE **subject to |ΔSpearman| < 0.005**, so ranking is never
sacrificed. An early positive-slope affine calibration was a real leaderboard
win; later, more aggressive local calibrations went flat or negative.

**Importance-weighted (covariate-shift) calibration.** A train-vs-test
logistic classifier on Morgan fingerprints produces a density ratio
`w(x) = p(test|x)/(1−p(test|x)) · (n_train/n_test)`, clipped to [1/3, 3] and
renormalized. This clip-and-normalize recipe was the top-ranked public-
leaderboard submission during Phase 1.

**High-activity tail adjustment.** The dominant error shape is **range
compression**: weak compounds are over-predicted and strong compounds
under-predicted (quantified in Section 9). The trusted Phase 1 anchor therefore
carries a targeted upward lift on compounds that are close Tanimoto neighbors
of the 46 potent seeds ("potent-46 soft gate", +0.35 pEC50 on flagged rows).

**Assay-level pairwise ranking on public PXR data.** A Boltz/ActFound-style
**same-assay pairwise** model was trained on ChEMBL / HTChem / single-conc PXR
data (both a scalar "beats-the-reference" pairrank score and a Siamese ChemProp
MPNN on same-assay deltas). Binding-only ChEMBL data transferred to PXR far
better than functional or broad data. These scores were used **only** as sparse
high/low gates on the anchor (shifting a handful of compounds), never as a
dense correction — a low-cap fold-wise LightGBM residual adapter was the
safer, out-of-fold-honest object.

## 7. Phase 1 → Phase 2

- **Phase 1** had live public-leaderboard feedback. The final Phase 1 system was
  the bagged-Caruana ensemble plus affine/importance calibration and the
  potent-46 anchor gate.
- **Phase 2** released the 253 AS1 labels but provided **no live leaderboard**
  for Activity, so every decision relied on pre-AS1 replay plus AS2 shift
  guardrails. AS1 was used for answer-checks and validation design, never as a
  reason to treat AS2 as trainable.
- **AS1 label incorporation:** a production model retrained the top-500 TabPFN v3
  recipe with the 253 AS1 labels added (4,140 → 4,393 training rows). A direct
  AS1-augmented model fits AS1 almost perfectly (MAE ≈ 0.09) but pushes AS2 too
  far from the anchor, so it was **blended conservatively**.
- **Final Phase 2 submission:** AS1 rows carry their released labels; AS2 rows =
  Phase-1 anchor + 0.45 × (AS1-augmented top-500 − anchor) + sparse ChEMBL /
  composite high-side gates on two compounds. The 0.45 blend weight was the
  "strict small move" point on an alpha ladder that balanced AS1-continuation
  gains against AS2 movement.

## 8. Interactive Charts (docs/ site)

The published site renders seven charts from real competition data:

1. **Final leaderboard** — MAE vs Spearman for all 95 competitors, this
   submission (rank 4) highlighted.
2. **Predicted vs actual** — the honest model-only predictions for all 513 test
   compounds (AS1 + AS2), colored by set.
3. **Tail compression** — AS2 mean true vs mean predicted per potency bin.
4. **Phase 1 vs Phase 2** — the five graded metrics side by side.
5. **Ensemble members** — Caruana weight vs standalone AS1 MAE.
6. **Local proxy quality** — AS1 MAE vs AS2 MAE across candidates (the OOF/LB
   disconnect made visible).
7. **Feature-family importance** — SHAP share of the top-500 features.

## 9. Error Analysis and Null Results

**Range compression is the dominant error mode.** On the blinded AS2 set, the
strongest-potency bin (true ≈ 6.30) is predicted ~0.70 too low and the weakest
bin (true ≈ 2.55) is predicted ~1.45 too high; mid-range compounds are
well-calibrated. The ensemble regresses toward the mean at both tails, and no
guardrail-safe correction fully removed this.

**Local error barely predicts blinded error.** Across honest candidates, AS1
MAE and AS2 MAE correlate only weakly (Pearson ≈ 0.16). This is the
project's recurring theme — small local (out-of-fold or AS1) gains routinely
failed to transfer to the leaderboard, and some reversed. Concrete cases:
- Adding two correlated CheMeleon members improved out-of-fold error but
  concentrated ensemble weight and dropped the public rank ("reverse
  amplification").
- Boltz Tier-0 tabular scalars passed both the out-of-fold and correlation
  gates yet regressed the leaderboard.
- Enabling ROCS self-match gave a false out-of-fold improvement that hurt the
  leaderboard (a leak).
- A per-fold top-500 selection on an 8,375-dim mega-concatenation had the best
  out-of-fold MAE but two leaderboard regressions (fold-structure overfitting).

**Other falsified directions:** direct pEC50 neural fine-tuning; an FMGCL
relative-distance auxiliary loss; Uni-Mol v2 seed-ensembling (failed the
correlation gate, zero Caruana weight); TwinBooster zero-shot assay-text priors;
"more ChEMBL pairs" (larger pair sets diluted the high-tail signal); and Boltz's
dynamic-range assay sampler (helped the low tail, hurt high-tail transfer).

The consistent conclusion: for this analog-expanded benchmark, **conservative,
correlation-gated, guardrail-checked changes** outperformed aggressive local
optimization.

## 10. Reproducibility and Links

- **Public research logs** (day-by-day experiment notes, wrong turns, null
  results — some in Japanese): Phase 1 issue
  [#100](https://github.com/N283T/pxr-iduction-challenge/issues/100) and Phase 2
  issue [#208](https://github.com/N283T/pxr-iduction-challenge/issues/208).
- **Challenge page:**
  <https://huggingface.co/spaces/openadmet/pxr-challenge>
- **Data:**
  [openadmet/pxr-challenge-train-test](https://huggingface.co/datasets/openadmet/pxr-challenge-train-test).

This public repository is a **report-only artifact**. The chart JSON under
`docs/assets/data/` is regenerated by `scripts/build_report_data.py` from the
private challenge working repository; raw feature matrices, model checkpoints,
and full prediction pools are intentionally not included here.
