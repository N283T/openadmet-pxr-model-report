#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "pandas",
#     "psycopg[binary]",
#     "pyarrow",
# ]
# ///
"""Build the JSON chart data for the PXR model-report GitHub Pages site.

This script emits small aggregated / per-point JSON files under
``docs/assets/data/``. Only the data actually needed to render the report charts
is exported; raw feature matrices, checkpoints and full prediction pools stay
out of the public repo.

Measured data comes from the challenge's working **database** — compounds,
assays, leaderboard rows — because it is the state the models were built
against. The parquets the challenge later distributed are a newer revision with
some compounds removed, so they no longer match the runs described here.

What still comes from the working repo, because the database does not hold it:
the per-model submission CSVs and member weights, the LightGBM gain audit, the
Boltz pooling report, and the Phase 2 answer-key replays.

Usage:
    ./scripts/build_report_data.py [--src /path/to/pxr-iduction-challenge] [--dsn ...]

The source repo defaults to a sibling checkout and the database to the local
cluster. Nothing here reaches the network.
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd
import psycopg

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("build_report_data")

# Repo-relative output directory (this file lives in <repo>/scripts/).
REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT.joinpath("docs", "assets", "data")

DEFAULT_SRC = Path("/home/nagaet/pxr-iduction-challenge")
# The challenge's working database, restored from the dump (see the slide repo's
# db/README.md). Anything measured per compound comes from here rather than from
# the distributed parquets: a later data update removed compounds the models
# were actually trained on, so the parquets no longer match the runs.
DEFAULT_DSN = "host=/tmp port=5433 user=postgres dbname=pxr"

AS1_TRUE_CSV = (
    "data",
    "hf_pxr_challenge_train_test",
    "pxr-challenge_TEST_PHASE_1_UNBLINDED.csv",
)
AS2_TRUE_CSV = (
    "data",
    "hf_pxr_challenge_train_test",
    "pxr-challenge_TEST_PHASE_2_UNBLINDED.csv",
)
# Static tabular-core diagnostics (from the per-model strategy notes).
# Per-fold LGBM-gain top-K sweep on the cheme+2D+Boltz+pred stack (proper CV OOF MAE).
TOPK_SWEEP = [
    {"k": 100, "mae": 0.4192, "spearman": 0.8263},
    {"k": 200, "mae": 0.4190, "spearman": 0.8260},
    {"k": 300, "mae": 0.4186, "spearman": 0.8267},
    {"k": 400, "mae": 0.4182, "spearman": 0.8274},
    {"k": 500, "mae": 0.4179, "spearman": 0.8279},
    {"k": 600, "mae": 0.4176, "spearman": 0.8264},
    {"k": 700, "mae": 0.4188, "spearman": 0.8258},
    {"k": 800, "mae": 0.4201, "spearman": 0.8258},
    {"k": 1000, "mae": 0.4237, "spearman": 0.8196},
    {"k": 1200, "mae": 0.4247, "spearman": 0.8203},
]
TOPK_FULL_MAE = 0.4212  # full 2103-dim, no selection
TOPK_FULL_SPEARMAN = 0.8236
# Per-fold LGBM-gain audit over the full cheme+2D+Boltz+pred stack.
GAIN_AUDIT_CSV = (
    "track1_activity",
    "analysis",
    "tabpfn_shape_diagnostic",
    "outputs",
    "top500_raw_feature_audit",
    "feature_gain_summary.csv",
)
GAIN_FAMILY_LABEL = {
    "log2fc_pred": "predicted log2fc",
    "mordred": "Mordred",
    "chemeleon": "CheMeleon",
    "boltz_tier1_conf": "Boltz-2 tier-1",
    "boltz_tier0": "Boltz-2 tier-0",
    "rdkit_full": "RDKit",
    "pose_jazzy": "pose-Jazzy",
}
GAIN_TOP_N = 12

# Per-compound master table + predicted log2fc + raw provided train files.
MASTER_PARQUET = ("data", "eda_redo", "master.parquet")
PLOG2FC_PARQUET = ("data", "ensemble4_log2fc_predictions.parquet")
CONC_8P25 = 8.251e-6  # 8.25 uM
CONC_33 = 3.30e-5  # 33 uM
# Single-concentration rows sit a hair off the nominal molarity, so match within
# a percent rather than on equality.
# One row per training compound: the label, the descriptors and Boltz-2 columns
# the correlation strip reads, and the observed log2fc at each concentration.
# Everything joins on compound_id.
TRAIN_FEATURES_SQL = """
    WITH obs AS (
        SELECT compound_id,
               avg(log2_fc_estimate) FILTER (
                   WHERE abs(concentration_m - %(c8)s) <= %(c8)s * 0.02) AS obs_8p25,
               avg(log2_fc_estimate) FILTER (
                   WHERE abs(concentration_m - %(c33)s) <= %(c33)s * 0.02) AS obs_33
          FROM single_concentration
         WHERE log2_fc_estimate IS NOT NULL
         GROUP BY compound_id
    )
    SELECT a.compound_id, a.pec50,
           o.obs_8p25, o.obs_33,
           b.affinity_pred_value, b.confidence_score, b.iptm,
           d.logp, d.amw, d.num_aromatic_rings, d.hbd, d.num_rotatable_bonds
      FROM train_activity a
      LEFT JOIN obs o USING (compound_id)
      LEFT JOIN compound_boltz2 b USING (compound_id)
      LEFT JOIN compound_descriptors d USING (compound_id)
"""
# Group sizes and per-label counts for the coverage grid. "aux" is a compound
# with a single-concentration row that is neither train nor test.
COVERAGE_SQL = """
    WITH tr AS (SELECT DISTINCT compound_id FROM train_activity),
         te AS (SELECT DISTINCT compound_id FROM test_activity),
         sc AS (SELECT DISTINCT compound_id FROM single_concentration
                 WHERE log2_fc_estimate IS NOT NULL),
         aux AS (SELECT compound_id FROM sc
                 EXCEPT SELECT compound_id FROM tr
                 EXCEPT SELECT compound_id FROM te),
         ct AS (SELECT DISTINCT compound_id FROM counter_assay WHERE pec50 IS NOT NULL)
    SELECT 'train' AS grp, (SELECT count(*) FROM tr) AS n,
           (SELECT count(*) FROM train_activity WHERE pec50 IS NOT NULL) AS pec50,
           (SELECT count(*) FROM train_activity WHERE emax_estimate IS NOT NULL) AS emax,
           (SELECT count(*) FROM ct JOIN tr USING (compound_id)) AS counter,
           (SELECT count(*) FROM sc JOIN tr USING (compound_id)) AS log2fc
    UNION ALL
    SELECT 'test', (SELECT count(*) FROM te), 0, 0,
           (SELECT count(*) FROM ct JOIN te USING (compound_id)),
           (SELECT count(*) FROM sc JOIN te USING (compound_id))
    UNION ALL
    SELECT 'aux', (SELECT count(*) FROM aux), 0, 0,
           (SELECT count(*) FROM ct JOIN aux USING (compound_id)),
           (SELECT count(*) FROM sc JOIN aux USING (compound_id))
"""
# The public-leaderboard row for each submission id.
LB_SUBMISSIONS_SQL = "SELECT id, lb_mae, lb_spearman FROM lb_submissions"
# Representative features for the correlation heatmap.
# (full label, short column header, master/pred column, family).
# Columns are grouped by family (log2fc, then Boltz, then descriptors) and sorted
# by |correlation| within each family.
#
# The observed log2fc is split per concentration rather than carried as one
# max-over-both column, so that "observed log2fc" means the same thing here as
# in the scatter panels. The columns that came out near zero are dropped rather
# than drawn: TPSA, fCsp3 and HBA at |r| <= 0.07, then Boltz-2 confidence, HBD
# and rotatable bonds, which were crowding the strip without saying anything.
FEATURE_CORR = [
    ("Predicted log2fc (8.25 µM)", "pred 8.25µM", "log2fc_8p25_pred", "log2fc"),
    ("Predicted log2fc (33 µM)", "pred 33µM", "log2fc_33_pred", "log2fc"),
    ("Observed log2fc (8.25 µM)", "obs 8.25µM", "obs_8p25", "log2fc"),
    ("Observed log2fc (33 µM)", "obs 33µM", "obs_33", "log2fc"),
    ("Boltz-2 affinity", "Boltz aff.", "affinity_pred_value", "boltz"),
    ("Boltz-2 ipTM", "Boltz ipTM", "iptm", "boltz"),
    ("logP", "logP", "logp", "desc"),
    ("Mol. weight", "MW", "amw", "desc"),
    ("Aromatic rings", "arom. rings", "num_aromatic_rings", "desc"),
]
FEATURE_CORR_FAMILY_ORDER = {"log2fc": 0, "boltz": 1, "desc": 2}
# The columns the section is arguing for; the chart boxes them.
FEATURE_CORR_PICK = {"log2fc_8p25_pred", "log2fc_33_pred"}
# Label-coverage matrix: which compound group carries which measured label.
# Groups are (display name, master flag column); a compound is "aux" if it has a
# single-concentration row but is neither train nor test.
COVERAGE_GROUPS = [
    ("Train (dose-response)", "train"),
    ("Blinded test", "test"),
    ("Single-conc-only aux", "aux"),
]
COVERAGE_LABEL_NAMES = ["pEC50", "Emax", "Counter", "log2fc"]
COVERAGE_LABELS = ["pec50", "emax", "counter", "log2fc"]


# Human-readable labels for the production ensemble members.
# Production ensemble members (canonical list from the Track-1 strategy report):
# label, Caruana weight, single-model out-of-fold MAE, role, and family (for color).
ENSEMBLE_MEMBERS = [
    {
        "key": "cheme_t10_full",
        "alias": "tabular-full",
        "label": "CheMeleon + 2D + Boltz + pred (full, 2103d)",
        "oofMae": 0.396,
        "role": "broad tabular core",
        "family": "tabular",
        "usesLog2fc": True,
    },
    {
        "key": "cheme_t10_top500",
        "alias": "tabular-top500",
        "label": "same feature stack, LightGBM-gain top-500",
        "oofMae": 0.397,
        "role": "selected tabular core",
        "family": "tabular",
        "usesLog2fc": True,
    },
    {
        "key": "chemprop_embed",
        "alias": "ChemProp",
        "label": "ChemProp D-MPNN, log2fc-pretrained embed",
        "oofMae": 0.437,
        "role": "frozen GNN embed",
        "family": "embed",
        "usesLog2fc": True,
    },
    {
        "key": "kermt",
        "alias": "KERMT",
        "label": "KERMT graph-transformer, log2fc-pretrained embed",
        "oofMae": 0.449,
        "role": "frozen graph-transformer",
        "family": "embed",
        "usesLog2fc": True,
    },
    {
        "key": "pooled_boltz",
        "alias": "Boltz-pocket",
        "label": "Boltz-2 trunk, pooled over the core pocket",
        "oofMae": 0.486,
        "role": "structural reserve",
        "family": "structural",
        "usesLog2fc": False,
    },
    {
        "key": "molformer_c3",
        "alias": "MoLFormer",
        "label": "MoLFormer-c3, log2fc-pretrained embed",
        "oofMae": 0.475,
        "role": "frozen transformer",
        "family": "embed",
        "usesLog2fc": True,
    },
    {
        "key": "pooled_boltz_allpairs",
        "alias": "Boltz-allpairs",
        "label": "Boltz-2 trunk, pooled over all protein-ligand pairs",
        "oofMae": 0.486,
        "role": "structural reserve",
        "family": "structural",
        "usesLog2fc": False,
    },
    {
        "key": "gatedgcn",
        "alias": "GatedGCN",
        "label": "GatedGCN, log2fc-pretrained embed",
        "oofMae": 0.474,
        "role": "frozen GNN embed",
        "family": "embed",
        "usesLog2fc": True,
    },
    {
        "key": "attentivefp",
        "alias": "AttentiveFP",
        "label": "AttentiveFP, log2fc-pretrained embed",
        "oofMae": 0.484,
        "role": "frozen GNN embed",
        "family": "embed",
        "usesLog2fc": True,
    },
]
# Production Caruana weights come from the reweight audit (weight_source="old_prod").
MEMBER_WEIGHTS_CSV = (
    "track1_activity",
    "analysis",
    "final_label_replay",
    "member_reweight_pre_post_weights.csv",
)
SUBMISSIONS_DIR = ("track1_activity", "submissions")
# Each member's test-prediction submission CSV, for the member-correlation heatmap.
MEMBER_SUBMISSION = {
    "cheme_t10_full": "tabpfn_cheme_2d_full_boltz_log2fc_pred_optuna_trial10_seed5ens_umap_default.csv",
    "cheme_t10_top500": "tabpfn_cheme_2d_full_boltz_log2fc_pred_optuna_trial10_seed5ens_top500_umap.csv",
    "chemprop_embed": "tabpfn_chemprop_pretrain_embed_umap_default.csv",
    "kermt": "tabpfn_kermt_pretrain_embed_umap_default.csv",
    "pooled_boltz": "tabpfn_pooled_boltz_umap_default.csv",
    "molformer_c3": "tabpfn_molformer_c3_pretrain_embed_umap.csv",
    "pooled_boltz_allpairs": "tabpfn_pooled_boltz_allpairs_umap_default.csv",
    "gatedgcn": "tabpfn_gatedgcn_pretrain_embed_umap_default.csv",
    "attentivefp": "tabpfn_attentivefp_pretrain_embed_umap_default.csv",
}


def _find_col(df: pd.DataFrame, *candidates: str) -> str:
    """Return the first column whose name matches one of ``candidates`` exactly."""
    for name in candidates:
        if name in df.columns:
            return name
    raise KeyError(f"None of {candidates!r} found in columns {list(df.columns)!r}")


def _write(name: str, payload: object) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR.joinpath(name)
    out_path.write_text(json.dumps(payload, indent=None, ensure_ascii=False))
    logger.info("wrote %s (%d bytes)", out_path, out_path.stat().st_size)


def _load_true_labels(src: Path) -> pd.DataFrame:
    frames = []
    for rel, phase in ((AS1_TRUE_CSV, "AS1"), (AS2_TRUE_CSV, "AS2")):
        d = pd.read_csv(src.joinpath(*rel))
        name_col = _find_col(d, "Molecule Name")
        pec_col = _find_col(d, "pEC50")
        frames.append(
            pd.DataFrame(
                {
                    "name": d[name_col].astype(str),
                    "true": pd.to_numeric(d[pec_col], errors="coerce"),
                    "set": phase,
                }
            )
        )
    return pd.concat(frames, ignore_index=True).dropna(subset=["true"])


def build_ensemble_members(src: Path) -> None:
    """Production ensemble members; Caruana weights from the reweight audit (old_prod)."""
    w = pd.read_csv(src.joinpath(*MEMBER_WEIGHTS_CSV))
    prod = w[(w["stage"] == "pre_as1") & (w["weight_source"] == "old_prod")]
    weight_by_key = prod.set_index("member")["weight"]
    members = []
    for m in ENSEMBLE_MEMBERS:
        entry = {k: v for k, v in m.items() if k != "key"}
        entry["weight"] = round(float(weight_by_key[m["key"]]), 3)
        members.append(entry)
    members.sort(key=lambda x: x["weight"], reverse=True)
    _write("ensemble_members.json", {"members": members})


def build_member_corr(src: Path) -> None:
    """Pairwise correlation of member test predictions, ordered by Caruana weight."""
    w = pd.read_csv(src.joinpath(*MEMBER_WEIGHTS_CSV))
    prod = w[(w["stage"] == "pre_as1") & (w["weight_source"] == "old_prod")]
    weight_by_key = prod.set_index("member")["weight"]
    ordered = sorted(ENSEMBLE_MEMBERS, key=lambda m: -float(weight_by_key[m["key"]]))
    merged = None
    for m in ordered:
        csv = src.joinpath(*SUBMISSIONS_DIR, MEMBER_SUBMISSION[m["key"]])
        d = pd.read_csv(csv)[["Molecule Name", "pEC50"]].rename(
            columns={"pEC50": m["alias"]}
        )
        merged = d if merged is None else merged.merge(d, on="Molecule Name")
    aliases = [m["alias"] for m in ordered]
    corr = merged[aliases].corr()
    matrix = [
        [round(float(corr.iloc[i, j]), 2) for j in range(len(aliases))]
        for i in range(len(aliases))
    ]
    _write("member_corr.json", {"aliases": aliases, "matrix": matrix})


def build_model_cards(src: Path) -> None:
    """Per-member test (AS1+AS2) metrics + weight + OOF MAE, keyed by alias."""
    truth = _load_true_labels(src)
    w = pd.read_csv(src.joinpath(*MEMBER_WEIGHTS_CSV))
    prod = w[(w["stage"] == "pre_as1") & (w["weight_source"] == "old_prod")]
    weight_by_key = prod.set_index("member")["weight"]
    cards = {}
    for m in ENSEMBLE_MEMBERS:
        sub = pd.read_csv(src.joinpath(*SUBMISSIONS_DIR, MEMBER_SUBMISSION[m["key"]]))
        sub = sub.rename(columns={"Molecule Name": "name", "pEC50": "pred"})[
            ["name", "pred"]
        ]
        d = truth.merge(sub, on="name").dropna(subset=["true", "pred"])
        y = d["true"].to_numpy()
        yh = d["pred"].to_numpy()
        spear = float(d["true"].rank().corr(d["pred"].rank()))
        cards[m["alias"]] = {
            "family": m["family"],
            "testMae": round(float(np.mean(np.abs(yh - y))), 3),
            "testSpearman": round(spear, 3),
            "oofMae": m["oofMae"],
            "weight": round(float(weight_by_key[m["key"]]), 3),
        }
    _write("model_cards.json", {"cards": cards})


# Curated Boltz trunk-pooling sweep, read from the trunk inventory report.
# (exp_name, display label, kept-into-ensemble). OOF MAE (mean) is parsed from
# the "Existing Boltz-Family Experiments" table so the numbers stay reproducible.
BOLTZ_POOLING_REPORT = (
    "track1_activity",
    "analysis",
    "boltz_trunk_fast_inventory",
    "outputs",
    "report.md",
)
# Blocks: s_prot_mean 384 + s_lig_mean 384 + z_mean 128 + z_max 128 (run_train.py).
# dim = which of those blocks the variant keeps.
BOLTZ_POOLING_SELECT = [
    (
        "tabpfn_pooled_boltz_allpairs_umap_default",
        "all 434 residues (allpairs)",
        True,
        1024,
    ),
    ("tabpfn_pooled_boltz_umap_default", "13-residue core pocket", True, 1024),
    ("tabpfn_pooled_boltz_ab_zonly_umap_default", "z pairs only", False, 256),
    ("tabpfn_pooled_boltz_ab_zmean_umap_default", "z mean-pool", False, 128),
    ("tabpfn_pooled_boltz_ab_sonly_umap_default", "single (s) only", False, 768),
    ("tabpfn_pooled_boltz_ab_slig_umap_default", "ligand single only", False, 384),
    ("tabpfn_pooled_boltz_ab_sprot_umap_default", "protein single only", False, 384),
    ("tabpfn_pooled_boltz_ab_zmax_umap_default", "z max-pool only", False, 128),
]


def build_boltz_pooling(src: Path) -> None:
    """Boltz trunk-pooling sweep (OOF MAE), curated from the inventory report."""
    text = src.joinpath(*BOLTZ_POOLING_REPORT).read_text()
    mae_by_name: dict[str, float] = {}
    for line in text.splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 3:
            continue
        try:
            mae_by_name[cells[1]] = float(cells[2])
        except ValueError:
            continue
    variants = []
    for exp_name, label, kept, dim in BOLTZ_POOLING_SELECT:
        if exp_name not in mae_by_name:
            raise SystemExit(f"pooling variant not found in report: {exp_name}")
        variants.append(
            {
                "label": label,
                "oofMae": round(mae_by_name[exp_name], 3),
                "kept": kept,
                "dim": dim,
            }
        )
    _write("boltz_pooling.json", {"variants": variants})


# Phase-1 calibration-and-gate journey, read from the LB submission ledger.
# (lb_submission id, short axis label, full label, is-anchor).
CALIB_ANCHOR_ID = 55  # id55, the Phase 1 anchor every delta is measured against
CALIB_JOURNEY = [
    (13, "raw", "Caruana ensemble (raw)", False),
    (19, "calibrated", "+ affine calibration", False),
    (31, "+seed ens", "+ seed-extended members", False),
    (51, "id51", "id51 · decorrelation anchor", False),
    (52, "id52", "id52 · trunk re-pool swap", False),
    (53, "id53", "id53 · trunk core-only", False),
    (54, "id54", "id54 · potent gate", False),
    (55, "id55", "id55 · gated top500 blend (potent-46)", True),
]


def build_calibration_journey(dsn: str) -> None:
    """Public-LB MAE across the Phase-1 calibration + tail-gate milestones."""
    df = query(dsn, LB_SUBMISSIONS_SQL)
    mae_by_id = df.drop_duplicates("id").set_index("id")["lb_mae"]
    # The ledger carried this column; against the anchor it is just a difference.
    delta_by_id = mae_by_id - mae_by_id[CALIB_ANCHOR_ID]
    milestones = []
    for sub_id, short, label, anchor in CALIB_JOURNEY:
        if sub_id not in mae_by_id.index:
            raise SystemExit(f"submission id not found in ledger: {sub_id}")
        milestones.append(
            {
                "id": int(sub_id),
                "short": short,
                "label": label,
                "lbMae": round(float(mae_by_id[sub_id]), 4),
                "deltaId55": round(float(delta_by_id[sub_id]), 4),
                "anchor": anchor,
            }
        )
    _write("calibration_journey.json", {"milestones": milestones})


# Phase-2 AS2 MAE regression, from the final-label answer-key replay.
PHASE2_DB_REPLAY = (
    "track1_activity",
    "analysis",
    "final_label_replay",
    "db_submission_replay_all.csv",
)
PHASE2_CAND_REPLAY = (
    "track1_activity",
    "analysis",
    "final_label_replay",
    "candidate_replay_all_phase2_and_db_submissions.csv",
)
# (lb_submission id, short label, note, kind)
PHASE2_AS2_SELECT = [
    (55, "id60 (=id55)", "Phase 1 anchor, resubmitted as the final id60", "phase1"),
    (61, "id61", "Phase 2: top500 AS1-aug blend", "phase2"),
    (62, "id62", "Phase 2: + pairrank gate", "phase2"),
    (63, "id63", "Phase 2 final (submitted)", "phase2"),
]
# Winner's public score (leaderboard rank 1, matcha-croissant).
PHASE2_WINNER_MAE = 0.4061


def build_phase2_as2(src: Path) -> None:
    """True AS2 MAE across the Phase-1-anchor to Phase-2-final submissions."""
    rep = pd.read_csv(src.joinpath(*PHASE2_DB_REPLAY))
    mae_by_id = rep.drop_duplicates("id").set_index("id")["as2_mae"]
    milestones = []
    for sub_id, label, note, kind in PHASE2_AS2_SELECT:
        if sub_id not in mae_by_id.index:
            raise SystemExit(f"submission id not found in replay: {sub_id}")
        milestones.append(
            {
                "label": label,
                "note": note,
                "kind": kind,
                "as2Mae": round(float(mae_by_id[sub_id]), 4),
            }
        )
    cand = pd.read_csv(src.joinpath(*PHASE2_CAND_REPLAY))
    hit = cand[cand["label"].str.contains("id55shape_t10top500_t40_soft_g35", na=False)]
    if hit.empty:
        raise SystemExit("hindsight-best candidate not found in replay")
    milestones.append(
        {
            "label": "id55shape",
            "note": "best AS2 in hindsight (not submitted)",
            "kind": "best",
            "as2Mae": round(float(hit.iloc[0]["as2_mae"]), 4),
        }
    )
    _write(
        "phase2_as2.json",
        {"milestones": milestones, "winnerMae": PHASE2_WINNER_MAE},
    )


def build_topk_sweep(src: Path) -> None:
    """LGBM-gain top-K dimension sweep vs OOF MAE (with the full-feature reference)."""
    _write(
        "topk_sweep.json",
        {
            "sweep": TOPK_SWEEP,
            "fullMae": TOPK_FULL_MAE,
            "fullSpearman": TOPK_FULL_SPEARMAN,
        },
    )


def _gain_audit(src: Path) -> pd.DataFrame:
    d = pd.read_csv(src.joinpath(*GAIN_AUDIT_CSV))
    return d[d["gain_mean"] > 0].copy()


def build_lgbm_gain(src: Path) -> None:
    """Share of LGBM-gain per feature family, over the full feature stack."""
    d = _gain_audit(src)
    grouped = d.groupby("family").agg(
        selected=("feature", "size"), share=("gain_share_pct", "sum")
    )
    families = [
        {
            "family": GAIN_FAMILY_LABEL.get(fam, fam),
            "selected": int(row["selected"]),
            "gainShare": round(float(row["share"]) / 100.0, 4),
        }
        for fam, row in grouped.iterrows()
    ]
    families.sort(key=lambda f: f["gainShare"], reverse=True)
    _write("lgbm_gain.json", {"families": families})


def query(dsn: str, sql: str, params: dict | None = None) -> pd.DataFrame:
    """Run one read-only query and hand back a frame."""
    with psycopg.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute(sql, params or {})
        columns = [c.name for c in cur.description]
        return pd.DataFrame(cur.fetchall(), columns=columns)


def train_frame(dsn: str) -> pd.DataFrame:
    """Everything the feature figures need per training compound, on compound_id."""
    frame = query(dsn, TRAIN_FEATURES_SQL, {"c8": CONC_8P25, "c33": CONC_33})
    return frame.set_index("compound_id")


def build_coverage(dsn: str) -> None:
    """Which compound group carries which measured label (counts + group sizes)."""
    counts = query(dsn, COVERAGE_SQL).set_index("grp")
    groups = []
    matrix = []
    for name, key in COVERAGE_GROUPS:
        row = counts.loc[key]
        groups.append({"name": name, "n": int(row["n"])})
        matrix.append([int(row[column]) for column in COVERAGE_LABELS])
    _write(
        "coverage.json",
        {"groups": groups, "labels": COVERAGE_LABEL_NAMES, "matrix": matrix},
    )


def _scatter_block(x: pd.Series, y: pd.Series, key: str, label: str) -> dict:
    d = pd.DataFrame(
        {"x": pd.to_numeric(x, errors="coerce"), "y": pd.to_numeric(y, errors="coerce")}
    ).dropna()
    r = round(float(d["x"].corr(d["y"])), 2)
    points = [[round(float(a), 2), round(float(b), 2)] for a, b in zip(d["x"], d["y"])]
    return {"key": key, "label": label, "r": r, "n": len(points), "points": points}


def build_feature_scatter(src: Path, dsn: str) -> None:
    """Four log2fc panels vs training pEC50: observed and predicted, at 8.25 and 33 uM."""
    frame = train_frame(dsn)
    pred = pd.read_parquet(src.joinpath(*PLOG2FC_PARQUET))
    frame = frame.join(pred, how="left")
    features = [
        _scatter_block(frame[column], frame["pec50"], key, label)
        for key, label, column in (
            ("obs_8p25", "Observed log2fc · 8.25 µM", "obs_8p25"),
            ("obs_33", "Observed log2fc · 33 µM", "obs_33"),
            ("pred_8p25", "Predicted log2fc · 8.25 µM", "log2fc_8p25_pred"),
            ("pred_33", "Predicted log2fc · 33 µM", "log2fc_33_pred"),
        )
    ]
    _write("feature_vs_pec50.json", {"features": features})


def build_feature_corr(src: Path, dsn: str) -> None:
    """Rank representative features by their single correlation with training pEC50."""
    frame = train_frame(dsn)
    pred = pd.read_parquet(src.joinpath(*PLOG2FC_PARQUET))
    frame = frame.join(pred, how="left")
    y = pd.to_numeric(frame["pec50"], errors="coerce")
    feats = []
    for label, short, column, family in FEATURE_CORR:
        d = pd.DataFrame(
            {"x": pd.to_numeric(frame[column], errors="coerce"), "y": y}
        ).dropna()
        if len(d) < 20:
            continue
        feats.append(
            {
                "label": label,
                "short": short,
                "family": family,
                "pearson": round(float(d["x"].corr(d["y"])), 2),
                # Spearman == Pearson on ranks (avoids a scipy dependency).
                "spearman": round(float(d["x"].rank().corr(d["y"].rank())), 2),
                "n": len(d),
                "pick": column in FEATURE_CORR_PICK,
            }
        )
    # Group by family (log2fc, Boltz, descriptors), sort by |correlation| within.
    feats.sort(
        key=lambda f: (FEATURE_CORR_FAMILY_ORDER[f["family"]], -abs(f["pearson"]))
    )
    _write(
        "feature_corr.json", {"rows": ["Pearson r", "Spearman r"], "features": feats}
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--src",
        type=Path,
        default=DEFAULT_SRC,
        help="Path to the local pxr-iduction-challenge working repo.",
    )
    parser.add_argument(
        "--dsn",
        default=DEFAULT_DSN,
        help="libpq connection string for the challenge's working database.",
    )
    args = parser.parse_args()
    src: Path = args.src
    dsn: str = args.dsn
    if not src.exists():
        raise SystemExit(f"Source repo not found: {src}")

    logger.info("source repo: %s", src)
    logger.info("database: %s", dsn)
    build_ensemble_members(src)
    build_coverage(dsn)
    build_topk_sweep(src)
    build_lgbm_gain(src)
    build_member_corr(src)
    build_model_cards(src)
    build_boltz_pooling(src)
    build_calibration_journey(dsn)
    build_phase2_as2(src)
    build_feature_scatter(src, dsn)
    build_feature_corr(src, dsn)
    logger.info("done -> %s", OUT_DIR)


if __name__ == "__main__":
    main()
