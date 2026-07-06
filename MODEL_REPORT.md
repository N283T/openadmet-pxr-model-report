# OpenADMET PXR Challenge — Track 1 Activity Model Report

Post-challenge technical report for the Track 1 (Activity) submission to the
OpenADMET PXR Induction Challenge (2026-04-01 → 2026-07-01). The task was to
predict PXR reporter activity (pEC50) for a blinded set of 513 compounds; the
metric was mean absolute error (MAE).

This is the text version of the report. An interactive version with charts is
published via GitHub Pages from the [`docs/`](docs/) directory; figures are
omitted here but every data table is retained.

## 0. TL;DR

- Finished **4th of 95** (Tier 1) predicting human PXR activation (pEC50) from
  structure alone: MAE **0.4059** in Phase 1, **0.4113** in Phase 2.
- The idea that decided it was **multi-fidelity transfer learning** (after
  [Buterez et al. 2024](https://www.nature.com/articles/s41467-024-45566-8)): the
  challenge quietly ships a cheap, single-concentration `log2fc` readout, and a
  model's **predicted log2fc is by far the single strongest feature**, doing the
  work of a full descriptor stack on its own.
- Around that signal sits a **nine-member Caruana ensemble** of frozen-embedding
  and tabular models read out by **TabPFN**. Boltz-2 earns a place not for its
  predicted structure or affinity (both too noisy) but as a learned
  representation.
- Past the ensemble, one affine **calibration** was the only clear gain; the
  Phase 1 tail gates and the whole of Phase 2 mostly added noise or made things
  worse. Knowing when to stop was, in hindsight, one of the better calls.

## 1. The challenge

This is the Track 1 (Activity) model report for the OpenADMET PXR Induction
Challenge. For the challenge background, biology, rules, and timeline see the
official pages: the
[announcement](https://openadmet.ghost.io/predicting-pxr-induction-we-have-liftoff/)
and the [Hugging Face Space](https://huggingface.co/spaces/openadmet/pxr-challenge).
Exploratory data analysis is out of scope here.

| Item | Value | Notes |
|---|---|---|
| Target | pEC50 | higher is a stronger PXR inducer |
| Metric | MAE | regression task |
| Training set | 4,140 | labeled compounds |
| Analog Set 1 (AS1) | 253 | unblinded at the start of Phase 2 |
| Analog Set 2 (AS2) | 260 | blinded throughout |
| Test total | 513 | AS1 + AS2 |

## 2. Results

Finished **4th of 95** graded competitors in the final (Phase 2) field, inside
the top significance tier.

| Phase | Field | MAE | RAE | R² | Spearman ρ | Kendall τ |
|---|---|---:|---:|---:|---:|---:|
| Phase 1 (AS1 + AS2, 513) | of 338 | **0.4059** (rank 4) | 0.5359 | 0.6496 | 0.8343 | 0.6459 |
| Phase 2 (AS2 only, 260) | of 95 | **0.4113** (rank 4) | 0.5703 | 0.6008 | 0.8161 | 0.6225 |

Lower is better for MAE and RAE; higher is better for R², Spearman ρ, and
Kendall τ. The two phases use different test slices, so their numbers are not
directly comparable. Organizers' write-ups:
[Phase 1 results](https://openadmet.ghost.io/woah-were-halfway-there/) and the
[post-challenge wrap-up](https://openadmet.ghost.io/its-the-end-of-the-pxr-challenge-as-we-know-it-and-i-feel-fine/).

## 3. Strategy

The strategy was built on Buterez et al.,
["Transfer learning with graph neural networks for improved molecular property prediction in the multi-fidelity setting"](https://www.nature.com/articles/s41467-024-45566-8)
(Nature Communications, 2024). Reaching that paper was, in hindsight, one of the
biggest reasons the result landed where it did.

### The auxiliary data

At first we built features and models from the pEC50 training labels alone; with
only 4,140 labels the accuracy plateaued quickly. The dataset also carries a
lower-cost PXR assay: a single-concentration reporter readout giving **log2
fold-change** (log2fc) at 8.25 µM and 33 µM, available for many more compounds.
We knew this auxiliary signal was there but not how to use it well, and turning it
into pseudo pEC50 labels only lowered accuracy. The dataset is really a
multi-stage assay funnel: the dose-response gives pEC50 and Emax, a PXR-null
counter assay adds selectivity, and the single-concentration screen provides
log2fc (two concentrations) for far more compounds than are ever taken to a full
curve.

### Finding Buterez et al.

To break the plateau, we had Claude Code draft a research prompt laying out the
exact situation (scarce pEC50, an abundant auxiliary assay, pseudo-labeling
failing) and asking how to exploit the auxiliary signal. Running that prompt
through ChatGPT Deep Research surfaced Buterez et al. The paper studies the
**multi-fidelity** setting: when a few expensive high-fidelity measurements sit
alongside many cheap low-fidelity ones, transfer learning can lift the
high-fidelity prediction, and using the low-fidelity signal as a *representation*
or a *prediction* tends to beat using it as extra labels. Mapped onto Track 1:

| Multi-fidelity concept | Our PXR correspondence |
|---|---|
| High-fidelity target | Track 1 pEC50 (4,140 labels) |
| Low-fidelity measurement | single-concentration log2fc at 8.25 and 33 µM |
| Low-fidelity model output | predicted log2fc, appended to the features (main axis) |
| Low-fidelity representation | frozen embedding of an encoder pretrained on log2fc (diversity axis) |
| Downstream high-fidelity model | TabPFN, as a per-member readout on the frozen representation |

### Predicted log2fc (pred): the strongest feature

Following the paper, we trained a **ChemProp** model to predict single-
concentration log2fc and used that prediction, **pred**, as a feature. Because
the assay is measured at two concentrations, pred is two columns (8.25 and 33
µM). The predicted columns track pEC50 more tightly (Pearson r ≈ 0.75 and 0.80,
over all 4,140 training compounds) than the raw observed measurements (r ≈ 0.72
and 0.50, and only over the 2,722 and 2,659 compounds where the assay was
actually run). Crucially, because pred is computed from structure alone it
exists for **every** compound, including the blinded test, which carries no
measured log2fc; the observed value simply is not available at test time.

By single correlation with pEC50, pred sits at the top, ahead of the raw
observed log2fc, the Boltz-2 affinity score (which points the opposite way, as a
log10 IC50), logP, and the physicochemical descriptors, which are individually
weak.

### How far does pred alone get?

Fitting a few deliberately simple models on the training pEC50 and scoring on the
now-unblinded test (AS1 + AS2):

| Feature | Model | Dims | MAE | Spearman |
|---|---|---:|---:|---:|
| pred 8.25 µM | linear | 1 | 0.609 | 0.782 |
| pred 33 µM | linear | 1 | 0.571 | 0.746 |
| pred log2fc (both) | linear | 2 | 0.572 | 0.725 |
| Boltz-2 affinity | linear | 1 | 0.747 | 0.602 |
| RDKit | LightGBM (untuned) | 217 | 0.570 | 0.677 |
| Phase 1 submission (reference) | ensemble | ~2,100 | 0.406 | 0.834 |

Two predicted-log2fc columns through a plain linear fit **match a 217-descriptor
untuned LightGBM** while ranking better, and clearly beat the Boltz-2 affinity
score. One assay-derived signal does the work of a full generic descriptor
model. These are quick post-challenge held-out fits
(`scripts/ablation_baselines.py`), not the production models.

## 4. The ensemble

The final system is nine members. They differ in how they turn a molecule into
features but share one thing: every member uses
[TabPFN](https://github.com/PriorLabs/tabpfn) as its readout head. Most encoders
are frozen and pretrained on the auxiliary log2fc signal.

| Alias | Encoder / features | Family | log2fc |
|---|---|---|:--:|
| tabular-full | CheMeleon + 2D + Boltz + pred (full, 2103d) | tabular core | ✓ |
| tabular-top500 | same feature stack, LightGBM-gain top-500 | tabular core | ✓ |
| ChemProp | ChemProp D-MPNN, log2fc-pretrained embed | frozen embed | ✓ |
| KERMT | KERMT graph-transformer, log2fc-pretrained embed | frozen embed | ✓ |
| Boltz-pocket | Boltz-2 trunk, pooled over the core pocket | Boltz structural | ✗ |
| MoLFormer | MoLFormer-c3, log2fc-pretrained embed | frozen embed | ✓ |
| Boltz-allpairs | Boltz-2 trunk, pooled over all protein-ligand pairs | Boltz structural | ✗ |
| GatedGCN | GatedGCN, log2fc-pretrained embed | frozen embed | ✓ |
| AttentiveFP | AttentiveFP, log2fc-pretrained embed | frozen embed | ✓ |

Members were compared with out-of-fold (OOF) predictions on a **UMAP cluster
split** (chemical clusters kept whole across folds). Several splits were tried,
but the choice did not matter much on the leaderboard, so a UMAP split was fixed
as a safe canonical.

The members are combined with **Caruana forward selection**
([Caruana et al., ICML 2004](https://dl.acm.org/doi/10.1145/1015330.1015432)), a
greedy scheme that repeatedly adds the member that most reduces OOF error.
Because weights come from bagged selection counts, no single member can dominate.

How independent are the members? Not very: they are **all highly correlated**
(r from 0.81 to 0.98, mean 0.88). The two tabular cores are near-duplicates
(0.98), the two Boltz-2 members too (0.97). So the ensemble is less a blend of
independent views than a **buffer** that keeps any one strong-but-correlated
member (especially top500) from dominating. The most decorrelated members are the
two Boltz-2 structural ones (0.81 to 0.88 against the chemistry members), which
is why they earn weight despite being weak alone.

## 5. The members

The nine members fall into three groups. On their own (OOF on training vs the
unblinded AS1 + AS2 test) the tabular pair leads, and for most members the test
bar is only slightly worse than out-of-fold.

### 5.1 Tabular core (tabular-full, tabular-top500)

The two heaviest members share one **~2,103-dimension tabular matrix**:

| Block | Dims | What it is |
|---|---:|---|
| [Mordred](https://mordred-descriptor.github.io/documentation/master/) | 1,515 | 2D molecular descriptors |
| [CheMeleon](https://github.com/JacksonBurns/chemeleon) | 300 | ChemProp-MPNN foundation fingerprint |
| [RDKit](https://rdkit.org/docs/index.html) | 217 | standard RDKit descriptors |
| Boltz-2 tier-1 | 44 | pocket-level pLDDT / PAE / PDE re-aggregations |
| Boltz-2 tier-0 | 19 | pose, confidence, and affinity scalars |
| pose-[Jazzy](https://jazzy.readthedocs.io/en/latest/) | 6 | H-bond / hydration on the Boltz pose |
| predicted log2fc | 2 | the pred columns from Strategy (8.25 and 33 µM) |

**CheMeleon** is not strong alone (a TabPFN on CheMeleon scores ~0.512 MAE) but
adding it helped: the tabular core went from MAE 0.443 without it to 0.421 with
it. **Boltz-2 features** come in two tiers: tier-0 is Boltz's own scalar outputs
(affinity, binding probability, confidence), tier-1 is our re-aggregation of the
raw per-token confidence tensors (pLDDT/PAE/PDE) into pocket-level statistics.

**top-500 selection.** tabular-full feeds all 2,103 features into TabPFN;
tabular-top500 first runs a per-fold LightGBM-gain **top-500 selection**.
Compressing the wide, partly noisy stack helps: OOF error dips around K = 500 to
600 and rises toward the full 2,103 dims. We fixed K = 500 (MAE flat 500–600,
best Spearman at 500). About **three quarters** of the LightGBM gain goes to the
two predicted-log2fc columns:

| Feature | Family | Gain share |
|---|---|---:|
| log2fc_8p25_pred | predicted log2fc | 51.6% |
| log2fc_33_pred | predicted log2fc | 22.1% |
| chemeleon_067 | CheMeleon | 0.30% |
| chemeleon_006 | CheMeleon | 0.23% |
| chemeleon_175 | CheMeleon | 0.20% |
| SLogP | Mordred | 0.18% |
| sa | pose-Jazzy | 0.16% |
| qed | RDKit | 0.13% |

**Why both?** tabular-top500 is the sharp, compressed view (strongest single
model OOF) and tabular-full is the broad, robust view of the same features.
Because top500 leans so hard on the pred/log2fc axis, running it alone is risky,
so Caruana splits the weight almost evenly (0.309 top500, 0.288 full). The
caution was justified: an aggressive top-500 swap once regressed the public MAE
from 0.407 to 0.413 while looking best out-of-fold.

*Post-challenge aside (issue [#222](https://github.com/N283T/pxr-iduction-challenge/issues/222)).*
Re-optimizing member weights against the now-unblinded AS2 confirms the axis is
real but easy to over-trust. Our top500 weight (0.31) was close to the AS2-optimal
(0.33), and simply zeroing it would have edged us out by a hair. The failure mode
is letting out-of-fold optimization inflate top500 to 0.84, which blows up on
AS2. These rows are a post-hoc member-weight study on the released AS2 labels,
not the literal Phase 2 submission (whose tail gates sat higher, Section 7):

| Weighting | top500 weight | AS2 MAE |
|---|---:|---:|
| Our weights (as used) | 0.31 | 0.405 |
| Zero the top500 weight | 0.00 | 0.402 |
| Optimized on AS2 (oracle) | 0.33 | 0.399 |
| Optimized on out-of-fold | 0.84 | 0.422 |

### 5.2 Frozen embeddings (ChemProp, KERMT, MoLFormer, GatedGCN, AttentiveFP)

Five members share one recipe: pretrain an encoder on the auxiliary log2fc (two
heads, 8.25 and 33 µM) over the 13,136 compounds, **freeze** it, extract one
fixed-length vector per compound, and hand only that to TabPFN. The encoder is
never fine-tuned on pEC50. The lesson, first proven on ChemProp, is that a frozen
log2fc-pretrained embedding read by TabPFN beats both training the encoder on
pEC50 from scratch and fine-tuning its head.

| Member | Backbone | Embed dims | OOF MAE | Weight |
|---|---|---:|---:|---:|
| ChemProp | D-MPNN | 256 | 0.437 | 0.151 |
| KERMT | graph transformer | 3,200 | 0.448 | 0.111 |
| MoLFormer | SMILES transformer | 768 | 0.475 | 0.040 |
| GatedGCN | gated GNN | 512 | 0.474 | 0.018 |
| AttentiveFP | graph attention | 512 | 0.484 | 0.002 |

**ChemProp** is the prototype and the strongest embedding member. It matters
twice: the same ChemProp-on-log2fc model produces the **pred** columns in the
tabular core, and its 256-dim frozen embedding is this standalone member. The
log2fc pretraining is a small multi-task setup (two regression heads, one per
concentration; missing targets masked; hyperparameters chosen with
[Optuna](https://optuna.org/) against downstream pEC50 OOF MAE). **Seed
averaging** was the main lever that sharpened pred (5 → 10 seeds improved the
downstream top-500 OOF MAE 0.399 → 0.397; 15 tapered off). Freezing beat the
alternatives out-of-fold: scratch pEC50 0.530, full fine-tune 0.507, frozen-head
fine-tune 0.456, versus 0.437 for the frozen embedding. *(A curiosity: those OOF
numbers oversold the margin. Scratch-pEC50 ChemProp scored ~0.53 OOF yet ~0.48 on
the unblinded test, much closer to the frozen member's 0.44, another case of OOF
and the blinded test disagreeing.)*

**Foundation encoders: KERMT & MoLFormer.** The same recipe on two larger
backbones. KERMT is a GROVER-style graph transformer (NVIDIA/Merck, pretrained on
~11M ZINC/ChEMBL molecules) continued-pretrained on log2fc → 3,200-dim embedding
(0.448, weight 0.111). MoLFormer is a SMILES transformer (DeepChem MoLFormer-c3),
LoRA-pretrained on log2fc → frozen 768-dim [CLS] vector (0.475, weight 0.040).
Not every backbone cleared the bar: **ChemBERTa** (5M/10M MTR variants) sat around
0.53 OOF and failed the Caruana add-value gate; a closer call,
[**UniMol-v2**](https://github.com/deepmodeling/Uni-Mol) (a 3D-conformer model on
the same frozen log2fc recipe) reached a respectable ~0.484 but still did not earn
enough added value to keep. Fine-tuning MoLFormer-XL straight to pEC50 was weak
(0.529) and dropped.

**Extra GNNs: GatedGCN & AttentiveFP.** Two more GNN backbones, same frozen
recipe, 512-dim embeddings. Several GNN variants were tried; these two are simply
the ones that came out best, with no deeper meaning to the architectures. Alone
they are weak (0.474, 0.484) with tiny weights (0.018, 0.002). Their real job is
the one the whole ensemble is built around: a **buffer** that keeps Caruana from
leaning everything back onto the top500 / cheme-log2fc core. Dropping them looks
better out-of-fold, but family share climbs toward ~0.94 and that
over-concentration regressed the leaderboard (shedding ~0.02 of member weight
amplified into ~0.1 more on the core and cost ~0.006 MAE).

### 5.3 Boltz-2 structural (Boltz-pocket, Boltz-allpairs)

A clarification the name obscures: despite "structural", these two never use
Boltz-2's predicted 3D pose. They read Boltz's internal learned **representation**
and hand it to TabPFN. Read them as representation models that happen to be built
on a structure predictor.

The original plan was to use [Boltz-2](https://github.com/jwohlwend/boltz)'s
predicted structure and affinity head directly: co-fold PXR (UniProt O75469, 434
residues) with each ligand and read activity off the pose or the affinity score.
Neither was usable on its own; the poses and the affinity scalar were too noisy
(that affinity scalar survives only as one weak column inside the tabular core).
But co-folding every compound had taken about four days of compute, and the run
had been launched with `--write_embeddings`, so the trunk representation was
already on disk. The question became whether Boltz is more useful as a
representation than as a structure predictor.

Instead of the pose or affinity head we take Boltz's internal **trunk
representation** (the per-token single tensor `s` and the token-pair tensor `z`)
and pool it into a fixed **1,024-dimension** vector: `s_prot_mean` (384) +
`s_lig_mean` (384) + `z_mean` (128) + `z_max` (128). `s` (single) summarizes each
side on its own; `z` (pair) is the residue-by-atom interaction block, where the
pocket-ligand interaction lives. **Boltz-pocket** and **Boltz-allpairs** keep
identical `s` blocks and differ only in which pair cells feed `z`: a fixed
13-residue core pocket versus all 434 residues, both by ligand atoms.

How to pool was its own small search (over twenty variants). Which residues you
pool over barely matters (pocket and allpairs land within 0.001 MAE). How you
reduce the pair tensor matters a lot: mean-pooling `z` is fine, but max-pooling
`z` alone collapses to 0.576. The pair representation carries most of the signal
(z alone ≈ 0.489; the single vectors are weaker), matching Boltz-2's own affinity
module emphasizing protein-ligand pairs. Feeding the embeddings through an
affinity-style head, or mixing in the distogram, did not particularly help. Two
poolings survived, each about 0.486 alone. TabPFN (0.486) beat LightGBM and an MLP
(0.512, 0.538) on the same vector.

Stepping back, these two ended up the only members carrying **no log2fc at all**,
and the most decorrelated from the rest (agreement with the other members averages
~0.85, below the ~0.88 pack). Reaching ~0.486 from co-folded structure alone, with
none of the log2fc signal that powers every other member, says the Boltz
representation holds real standalone signal, a strong showing against a direct
MoLFormer-XL fine-tune (0.529). The caveat: on the unblinded test a from-scratch
ChemProp actually reached ~0.484, so structure is not uniquely winning. But it is
a nice negative-space finding: for this target, Boltz-2 was worth more read as a
learned representation than used for its predicted structure or affinity.

## 6. Calibration and the final tail gates

Two levers were left once the ensemble was built: calibrating its output, and a
set of tail gates. The honest summary is one clear win followed by a plateau. A
simple affine calibration pulled the raw Caruana blend from about **0.441** down
to **0.408** on the public leaderboard. Everything after that, the id51 to id55
run of tail gates, moved the score by less than 0.004 MAE either way, noise
against the calibration step. **id55** became the Phase 1 anchor by a hair; a few
later tries never beat it, so we closed Phase 1 by resubmitting that same model
unchanged as id60.

**Calibration** is a post-hoc regression on the ensemble's own output: a
one-dimensional map from raw predicted pEC50 to a corrected one, fit on the 4,140
out-of-fold predictions against the true labels (positive-slope affine, with an
isotonic variant), validated under 5-fold nested CV so the calibrator could not
overfit. The shipped version, `calibrated_importance`, adds a covariate-shift
correction: each training compound is reweighted by a density ratio
`P(test|x)/(1−P(test|x))`, clipped to [1/3, 3], so the fit leans on the training
points that most resemble the blinded test set. That single step is where the
real 0.44 → 0.41 gain came from.

Everything past that was competition craft, not research. The id50–id60 tuning was
largely done by watching the public leaderboard. The final anchor decodes to a
short recipe: `id55 = calibrated ensemble (id51) + top500 member swap + a soft
potent-46 high-activity lift (threshold 40, gain 0.35)`. The whole run is flat:

| id | Change | Public-LB MAE |
|---|---|---:|
| id50 | internal-decorrelation blend | 0.4092 |
| id51 | meta-axis anchor over id50 | 0.4073 |
| id52 | re-pooled Boltz trunk swap | 0.4087 |
| id53 | trunk core-only variant | 0.4106 |
| id54 | id51 + potent gate | 0.4096 |
| **id55** | + top500 swap + soft potent-46 gate (anchor) | 0.4071 |
| id56 | Optuna-tuned member swap | 0.4135 |
| id57 | softer potent gate (g50) | 0.4074 |
| id58 | combo gate rank | 0.4075 |
| id59 | high-activity lift rank | 0.4077 |
| **id60** | id55 resubmitted, final Phase 1 entry | 0.4059 |

id55 and id60 are the same model; the 0.4071 vs 0.4059 gap is pure leaderboard
scatter, wider than most of the "improvements" in between.

The one part that kept mattering was the **tail**. The most potent compounds
(pEC50 ≥ 6) are systematically under-predicted; the model shrinks them toward the
mean by nearly a full log unit (bias ≈ -0.8 in that bin), and no global
calibration reaches it. We tried the obvious handles (a potent-compound lift and
a few descriptor gates: log2fc, ring-count, family-gap), but on the public
leaderboard none separated from noise. The tail stayed the one genuinely unsolved
piece of Phase 1.

## 7. Phase 1 → Phase 2

Ending Phase 1 back on that anchor looked timid at the time. On the public
leaderboard we were sitting around eighth, with several teams posting visibly
better public scores. But that board was exactly the noisy proxy we had just
decided not to chase, and on the blinded final test the restraint paid off:
**4th of 95**. Not overfitting the public leaderboard was, in hindsight, one of
the better calls of Phase 1.

In Phase 2 that same instinct had almost nothing safe to push on. Phase 2 Activity
ran fully blind, with no public leaderboard to steer by, and on the now-known AS2
labels every edit we made moved the predictions the wrong way. The Phase 1 anchor
(id55, resubmitted as id60) sat at 0.4075 on AS2; each Phase 2 change drifted up
and away, ending at 0.4123 for the submitted id63.

| id | What it added | AS2 MAE | Δ vs id60 |
|---|---|---:|---:|
| **id60 (=id55)** | Phase 1 anchor | 0.4075 | baseline |
| id61 | AS1 labels + top500 AS1-aug blend (α 0.40) | 0.4121 | +0.0046 |
| id62 | + ChEMBL pairrank high-activity gate | 0.4115 | +0.0040 |
| **id63** | + composite pairrank/ChemProp gate, α 0.45 (final) | 0.4123 | +0.0048 |

What went wrong, roughly in order:

- **Retraining on the released AS1 labels and blending in a top500 AS1-augmented
  model.** It pulled AS2 toward the new model, but AS1 retraining barely improved
  AS2 for most members, so the blend mostly imported error.
- **A family of gate models to catch the tail**, built from external ChEMBL /
  public-PXR activity: pairrank ranking and classifier models, in the spirit of
  Boltz-2's affinity head (which trains on pairwise ranking). They spotted
  high-activity compounds well (AUC around 0.88), but identification was not the
  hard part: knowing *which* compounds to move says nothing about *how far*, and
  getting the magnitude wrong cost more MAE than the ranking saved.
- **Leaving the low tail alone, the one call that paid off.** A low-side shift
  risks a large error when it fires on the wrong compound, so we never applied
  one; the answer key later confirmed the restraint was right.

The submitted candidate bundled these together:
`id63 = AS1 rows filled with released labels; AS2 = the id55/id60 anchor blended
0.45 toward an AS1-augmented top500 model, plus a ChEMBL pairrank high-activity
gate (+0.15) and a composite pairrank/ChemProp gate (+0.15), with no low-side
shift.`

The blunt version: from the Phase 1 anchor onward, everything we could do to AS2
made it worse, though going in we assumed the opposite. Folding in the released
AS1 labels felt like it could only help, so we even pushed the blend from 0.40 up
to 0.45. That doing *nothing* at all would have been the right answer was not
something we could have called at the time.

And it cuts both ways. The bar we did not submit,
`id55shape_t10top500_t40_soft_g35`, reaches **0.4056** on the true AS2 labels,
just under the winning 0.4061, and in hindsight would have taken first. We benched
it for moving too many values too far and failing our own preflight check. At the
other extreme, simply holding the conservative id60 anchor (0.4075) would already
have beaten what we submitted. Adding a little was the worst of the three, and at
submission time there was no way to tell the winning bet from the losing one. That
is the hard part of a blind competition.

*Answer-key check (issue [#222](https://github.com/N283T/pxr-iduction-challenge/issues/222)).*
Replaying candidates against the now-unblinded AS1 + AS2, the best build was a
mechanical anchor-residual stacker put together without ever looking at a
leaderboard, at about **0.405**, ahead of the importance-calibrated ensemble
(0.407) and of everything we actually submitted in Phase 2. Past a certain point
the extra machinery cost more than it bought; the discipline of doing less was,
twice over, the better model.

## 8. Conclusion

What decided this was a framing, not a model. Reaching **multi-fidelity transfer
learning** is the reason the submission worked at all: the challenge quietly
ships a cheap, single-concentration log2fc readout, and learning to predict it
turns that low-fidelity signal into the strongest feature we had. A few takeaways
worth keeping:

- **Cheap activity data is underrated.** Turning a low-cost, single-concentration
  assay into the backbone of a pEC50 model should transfer to real screening
  pipelines, where noisy high-throughput readouts are plentiful and gold-standard
  labels are scarce.
- **Use the raw signal.** The predicted log2fc columns, straight from an assay the
  data already contains, beat every engineered descriptor and every foundation
  embedding on their own. When a directly relevant measurement exists, model it
  before reaching for generic features.
- **TabPFN punches far above its weight** as a readout head, and it was not alone:
  LightGBM and even a KAN readout (barely mentioned in this report) were strong on
  the same vectors.
- **Predicted structure and affinity disappointed.** Boltz-2's pose and affinity
  head were too noisy to use directly; the model only paid off read as a
  representation. For actual activity prediction, off-the-shelf affinity models
  were the weakest link.

On a personal note, this was my first competition, and finishing 4th of 95 is more
than I expected going in. I leaned heavily on AI coding agents and ChatGPT
throughout, for literature search, code, and iteration, and got a great deal out
of that workflow; I want to write about it properly somewhere else. And the whole
thing ran solo on a single consumer gaming PC, which, for a Tier-1 finish against
95 entrants, still feels a little unreasonable.

## Reproducibility and links

- **Working repository** (code, feature pipeline, day-by-day logs):
  [N283T/pxr-iduction-challenge](https://github.com/N283T/pxr-iduction-challenge).
- **Public research logs** (day-by-day notes, wrong turns, null results, some in
  Japanese): Phase 1 issue
  [#100](https://github.com/N283T/pxr-iduction-challenge/issues/100), Phase 2 issue
  [#208](https://github.com/N283T/pxr-iduction-challenge/issues/208), and the
  post-competition AS2 answer-check log
  [#222](https://github.com/N283T/pxr-iduction-challenge/issues/222).
- **Challenge page:** <https://huggingface.co/spaces/openadmet/pxr-challenge>
- **Data:**
  [openadmet/pxr-challenge-train-test](https://huggingface.co/datasets/openadmet/pxr-challenge-train-test).

This public repository is a **report-only artifact**. The chart JSON under
`docs/assets/data/` is regenerated by `scripts/build_report_data.py` from the
private challenge working repository; raw feature matrices, model checkpoints, and
full prediction pools are intentionally not included here.
