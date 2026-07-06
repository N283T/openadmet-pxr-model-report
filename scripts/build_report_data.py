#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "pandas",
#     "pyarrow",
# ]
# ///
"""Build the JSON chart data for the PXR model-report GitHub Pages site.

This script reads the *local, un-committed* challenge working repo and emits
small aggregated / per-point JSON files under ``docs/assets/data/``. Only the
data actually needed to render the report charts is exported; raw feature
matrices, checkpoints and full prediction pools stay out of the public repo.

Usage:
    ./scripts/build_report_data.py [--src /path/to/pxr-iduction-challenge]

The source repo defaults to a sibling checkout. Nothing here reaches the network.
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("build_report_data")

# Repo-relative output directory (this file lives in <repo>/scripts/).
REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT.joinpath("docs", "assets", "data")

DEFAULT_SRC = Path("/home/nagaet/pxr-iduction-challenge")

# The final leaderboard snapshot (competition closed 2026-07-01).
LEADERBOARD_CSV = (
    "docs",
    "leaderboards",
    "activity",
    "leaderboard_2026-07-03_1426JST.csv",
)
# Per-phase leaderboards for computing this submission's per-metric ranks.
# Phase 1 result (scored on AS1 + AS2) is the 2026-05-28 snapshot; Phase 2 (AS2
# only) is the final snapshot above.
PHASE1_LEADERBOARD = (
    "docs",
    "leaderboards",
    "activity",
    "leaderboard_2026-05-28_2052JST.csv",
)
ME = "N283T"
# One honest *model-only* submission (no leaked Analog-Set-1 labels) used for the
# unified predicted-vs-actual scatter across the full 513-compound blinded test.
MODEL_ONLY_SUBMISSION = (
    "track1_activity",
    "submissions",
    "phase2_as1_aug_suite_id55shape_t10top500_t40_soft_g35_model_only.csv",
)
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
AS2_BIN_CSV = (
    "track1_activity",
    "analysis",
    "final_label_replay",
    "final_vs_best_as2_loss_by_bin.csv",
)
MEMBER_REPLAY_CSV = (
    "track1_activity",
    "analysis",
    "final_label_replay",
    "base_ensemble_member_as1_pre_post_replay_long.csv",
)
PROXY_CSV = (
    "track1_activity",
    "analysis",
    "final_label_replay",
    "candidate_replay_all_phase2_and_db_submissions.csv",
)
SHAP_FAMILY_CSV = (
    "track1_activity",
    "analysis",
    "tabpfn26_shap_top500",
    "family_summary.csv",
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
DEFAULT_TRAIN_PARQUET = ("data", "default_train.parquet")
SINGLECONC_TRAIN_PARQUET = ("data", "single_concentration_train.parquet")
CONC_8P25 = 8.251e-6  # 8.25 uM
CONC_33 = 3.30e-5  # 33 uM
# Representative features for the correlation heatmap.
# (full label, short column header, master/pred column, family).
# Columns are grouped by family (log2fc, then Boltz, then descriptors) and sorted
# by |correlation| within each family.
FEATURE_CORR = [
    ("Predicted log2fc (8.25 µM)", "pred 8.25µM", "log2fc_8p25_pred", "log2fc"),
    ("Predicted log2fc (33 µM)", "pred 33µM", "log2fc_33_pred", "log2fc"),
    ("Observed log2fc (max)", "obs log2fc", "single_max_log2_fc", "log2fc"),
    ("Boltz-2 affinity", "Boltz aff.", "b2_affinity_pred", "boltz"),
    ("Boltz-2 confidence", "Boltz conf.", "b2_confidence", "boltz"),
    ("Boltz-2 ipTM", "Boltz ipTM", "b2_iptm", "boltz"),
    ("logP", "logP", "logp", "desc"),
    ("TPSA", "TPSA", "tpsa", "desc"),
    ("Mol. weight", "MW", "amw", "desc"),
    ("Fraction Csp3", "fCsp3", "fractioncsp3", "desc"),
    ("Aromatic rings", "arom. rings", "num_aromatic_rings", "desc"),
    ("H-bond donors", "HBD", "hbd", "desc"),
    ("H-bond acceptors", "HBA", "hba", "desc"),
    ("Rotatable bonds", "rot. bonds", "num_rotatable_bonds", "desc"),
]
FEATURE_CORR_FAMILY_ORDER = {"log2fc": 0, "boltz": 1, "desc": 2}
# Label-coverage matrix: which compound group carries which measured label.
# Groups are (display name, master flag column); a compound is "aux" if it has a
# single-concentration row but is neither train nor test.
COVERAGE_GROUPS = [
    ("Train (dose-response)", "train"),
    ("Blinded test", "test"),
    ("Single-conc-only aux", "aux"),
]
COVERAGE_LABELS = [
    ("pEC50", "train_pec50"),
    ("Emax", "train_emax"),
    ("Counter", "counter_pec50"),
    ("log2fc", "single_max_log2_fc"),
]

# Graded metrics: (json key, leaderboard column, higher_is_better).
PHASE_METRIC_COLS = [
    ("mae", "MAE", False),
    ("rae", "RAE", False),
    ("r2", "R2", True),
    ("spearman", "Spearman ρ", True),
    ("kendall", "Kendall's τ", True),
]
# Each graded phase and the leaderboard snapshot that carries its final scores.
PHASE_LEADERBOARDS = [
    ("Phase 1", "AS1 + AS2 (513)", PHASE1_LEADERBOARD),
    ("Phase 2", "AS2 (260)", LEADERBOARD_CSV),
]

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


def build_leaderboard(src: Path) -> None:
    df = pd.read_csv(src.joinpath(*LEADERBOARD_CSV))
    tier_col = _find_col(df, "Significance (tiers)")
    rows = [
        {
            "rank": int(r["rank"]),
            "username": str(r["username"]),
            "mae": round(float(r["MAE"]), 4),
            "rae": round(float(r["RAE"]), 4),
            "r2": round(float(r["R2"]), 4),
            "spearman": round(float(r["Spearman ρ"]), 4),
            "kendall": round(float(r["Kendall's τ"]), 4),
            "tier": str(r[tier_col]),
            "isMe": str(r["username"]) == "N283T",
        }
        for _, r in df.iterrows()
    ]
    _write("leaderboard.json", {"n": len(rows), "rows": rows})


def build_phase_metrics(src: Path) -> None:
    """Read each phase leaderboard and record this submission's value and rank per metric."""
    phases = []
    for name, evaluated_on, rel in PHASE_LEADERBOARDS:
        df = pd.read_csv(src.joinpath(*rel))
        me_rows = df[df["username"] == ME]
        if me_rows.empty:
            raise ValueError(f"{ME} not found in {rel[-1]}")
        me = me_rows.iloc[0]
        entry = {
            "phase": name,
            "evaluatedOn": evaluated_on,
            "nCompetitors": int(len(df)),
        }
        ranks = {}
        for key, col, higher in PHASE_METRIC_COLS:
            vals = pd.to_numeric(df[col], errors="coerce").dropna()
            mine = float(me[col])
            better = (vals > mine) if higher else (vals < mine)
            entry[key] = round(mine, 4)
            ranks[key] = int(better.sum()) + 1
        entry["ranks"] = ranks
        phases.append(entry)
    _write("phase_metrics.json", {"phases": phases})


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


def build_scatter(src: Path) -> None:
    """Unified honest predicted-vs-actual scatter over the full 513 test compounds."""
    sub = pd.read_csv(src.joinpath(*MODEL_ONLY_SUBMISSION))
    name_col = _find_col(sub, "Molecule Name")
    pred_col = _find_col(sub, "pEC50")
    preds = pd.DataFrame(
        {
            "name": sub[name_col].astype(str),
            "pred": pd.to_numeric(sub[pred_col], errors="coerce"),
        }
    )
    truth = _load_true_labels(src)
    merged = truth.merge(preds, on="name", how="inner").dropna(subset=["true", "pred"])
    points = [
        {
            "name": row["name"],
            "true": round(float(row["true"]), 3),
            "pred": round(float(row["pred"]), 3),
            "set": row["set"],
        }
        for _, row in merged.iterrows()
    ]
    # Simple per-set MAE for annotation.
    merged = merged.assign(ae=(merged["pred"] - merged["true"]).abs())
    mae_by_set = {s: round(float(g["ae"].mean()), 4) for s, g in merged.groupby("set")}
    _write(
        "scatter_pred_actual.json",
        {
            "n": len(points),
            "maeBySet": mae_by_set,
            "source": "model-only submission (no leaked Analog-Set-1 labels)",
            "points": points,
        },
    )


def build_calibration_bins(src: Path) -> None:
    """AS2 (fully blinded) per-potency-bin mean true vs mean predicted -> tail compression."""
    df = pd.read_csv(src.joinpath(*AS2_BIN_CSV))
    label_map = {
        "lt3": "< 3",
        "3to4": "3–4",
        "4to5": "4–5",
        "5to6": "5–6",
        "gte6": "≥ 6",
    }
    bins = [
        {
            "bin": label_map.get(str(r["bin"]), str(r["bin"])),
            "n": int(r["n"]),
            "meanTrue": round(float(r["mean_true"]), 3),
            "meanPred": round(float(r["mean_final_pred"]), 3),
            "bias": round(float(r["mean_final_pred"] - r["mean_true"]), 3),
        }
        for _, r in df.iterrows()
    ]
    _write("calibration_bins.json", {"set": "AS2 (blinded)", "bins": bins})


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
CALIB_LEDGER = (
    "track1_activity",
    "analysis",
    "oof_proxy_diagnostics",
    "lb_submission_direction_table.csv",
)
CALIB_JOURNEY = [
    (13, "raw", "Caruana ensemble (raw)", False),
    (31, "calibrated", "+ affine calibration", False),
    (51, "id51", "id51 · decorrelation anchor", False),
    (52, "id52", "id52 · trunk re-pool swap", False),
    (53, "id53", "id53 · trunk core-only", False),
    (54, "id54", "id54 · potent gate", False),
    (55, "id55", "id55 · top500 + potent + soft gate", True),
]


def build_calibration_journey(src: Path) -> None:
    """Public-LB MAE across the Phase-1 calibration + tail-gate milestones."""
    df = pd.read_csv(src.joinpath(*CALIB_LEDGER))
    mae_by_id = df.drop_duplicates("id").set_index("id")["lb_mae"]
    delta_by_id = df.drop_duplicates("id").set_index("id")["delta_lb_mae_vs_id55"]
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


def build_proxy(src: Path) -> None:
    """Local Analog-Set-1 MAE vs blinded Analog-Set-2 MAE across every candidate."""
    df = pd.read_csv(src.joinpath(*PROXY_CSV))
    # Drop candidates that folded in the released AS1 labels (as1_mae ~ 0, not honest).
    honest = df[(~df["fills_as1_labels"].fillna(False)) & (df["as1_mae"] > 0.2)].copy()
    points = []
    for _, r in honest.iterrows():
        if pd.isna(r["as1_mae"]) or pd.isna(r["as2_mae"]):
            continue
        points.append(
            {
                "label": str(r["label"]),
                "as1": round(float(r["as1_mae"]), 4),
                "as2": round(float(r["as2_mae"]), 4),
            }
        )
    corr = round(float(honest["as1_mae"].corr(honest["as2_mae"])), 3)
    _write("proxy_as1_as2.json", {"n": len(points), "pearson": corr, "points": points})


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


def build_lgbm_top_features(src: Path) -> None:
    """Top individual features by per-fold LGBM gain."""
    d = _gain_audit(src).sort_values("gain_mean", ascending=False).head(GAIN_TOP_N)
    rows = [
        {
            "feature": str(r["feature"]).split("__", 1)[-1],
            "family": GAIN_FAMILY_LABEL.get(str(r["family"]), str(r["family"])),
            "gainShare": round(float(r["gain_share_pct"]), 2),
        }
        for _, r in d.iterrows()
    ]
    _write("lgbm_top_features.json", {"features": rows})


def build_coverage(src: Path) -> None:
    """Which compound group carries which measured label (counts + group sizes)."""
    m = pd.read_parquet(src.joinpath(*MASTER_PARQUET))
    tr = m["in_train"].fillna(False)
    te = m["in_test"].fillna(False)
    si = m["in_single"].fillna(False)
    masks = {"train": tr, "test": te, "aux": si & ~tr & ~te}
    groups = []
    matrix = []
    for gname, gkey in COVERAGE_GROUPS:
        mask = masks[gkey]
        groups.append({"name": gname, "n": int(mask.sum())})
        matrix.append(
            [int((mask & m[col].notna()).sum()) for _, col in COVERAGE_LABELS]
        )
    _write(
        "coverage.json",
        {
            "groups": groups,
            "labels": [label for label, _ in COVERAGE_LABELS],
            "matrix": matrix,
        },
    )


def build_sankey(src: Path) -> None:
    """Assay-flow Sankey (conservation-consistent, from master flags). Test is omitted."""
    m = pd.read_parquet(src.joinpath(*MASTER_PARQUET))
    tr = m["in_train"].fillna(False)
    te = m["in_test"].fillna(False)
    si = m["in_single"].fillna(False)
    n_train = int(tr.sum())
    train_with_single = int((tr & m["single_max_log2_fc"].notna()).sum())
    aux_only = int((si & ~tr & ~te).sum())
    direct_to_drc = n_train - train_with_single
    counter = int((tr & m["counter_pec50"].notna()).sum())
    nodes = [
        {"name": "Single-conc screen"},
        {"name": "Direct to dose-response"},
        {"name": "Aux only (log2fc)"},
        {"name": "Dose-response train"},
        {"name": "Counter assay"},
    ]
    links = [
        {
            "source": "Single-conc screen",
            "target": "Aux only (log2fc)",
            "value": aux_only,
        },
        {
            "source": "Single-conc screen",
            "target": "Dose-response train",
            "value": train_with_single,
        },
        {
            "source": "Direct to dose-response",
            "target": "Dose-response train",
            "value": direct_to_drc,
        },
        {"source": "Dose-response train", "target": "Counter assay", "value": counter},
    ]
    _write("sankey.json", {"nodes": nodes, "links": links})


def _scatter_block(x: pd.Series, y: pd.Series, key: str, label: str) -> dict:
    d = pd.DataFrame(
        {"x": pd.to_numeric(x, errors="coerce"), "y": pd.to_numeric(y, errors="coerce")}
    ).dropna()
    r = round(float(d["x"].corr(d["y"])), 2)
    points = [[round(float(a), 2), round(float(b), 2)] for a, b in zip(d["x"], d["y"])]
    return {"key": key, "label": label, "r": r, "n": len(points), "points": points}


def build_feature_scatter(src: Path) -> None:
    """Four log2fc panels vs training pEC50: observed and predicted, at 8.25 and 33 uM."""
    features = []
    # Observed log2fc per concentration, joined to pEC50 by Molecule Name.
    sc = pd.read_parquet(src.joinpath(*SINGLECONC_TRAIN_PARQUET))
    tr = pd.read_parquet(src.joinpath(*DEFAULT_TRAIN_PARQUET))[
        ["Molecule Name", "pEC50"]
    ]
    for key, label, conc in (
        ("obs_8p25", "Observed log2fc · 8.25 µM", CONC_8P25),
        ("obs_33", "Observed log2fc · 33 µM", CONC_33),
    ):
        at = sc[(sc["concentration_M"] - conc).abs() <= conc * 0.02]
        at = at.groupby("Molecule Name", as_index=False)["log2_fc_estimate"].mean()
        j = at.merge(tr, on="Molecule Name", how="inner")
        features.append(_scatter_block(j["log2_fc_estimate"], j["pEC50"], key, label))
    # Predicted log2fc per concentration, joined to pEC50 by compound_id.
    m = pd.read_parquet(src.joinpath(*MASTER_PARQUET))
    pred = pd.read_parquet(src.joinpath(*PLOG2FC_PARQUET))
    mp = m[m["in_train"].fillna(False)].merge(
        pred, left_on="compound_id", right_index=True, how="inner"
    )
    for key, label, col in (
        ("pred_8p25", "Predicted log2fc · 8.25 µM", "log2fc_8p25_pred"),
        ("pred_33", "Predicted log2fc · 33 µM", "log2fc_33_pred"),
    ):
        features.append(_scatter_block(mp[col], mp["train_pec50"], key, label))
    _write("feature_vs_pec50.json", {"features": features})


def build_feature_corr(src: Path) -> None:
    """Rank representative features by their single Pearson correlation with training pEC50."""
    m = pd.read_parquet(src.joinpath(*MASTER_PARQUET))
    pred = pd.read_parquet(src.joinpath(*PLOG2FC_PARQUET))
    m = m.merge(pred, left_on="compound_id", right_index=True, how="left")
    m = m[m["in_train"].fillna(False)]
    y = pd.to_numeric(m["train_pec50"], errors="coerce")
    feats = []
    for label, short, col, family in FEATURE_CORR:
        d = pd.DataFrame({"x": pd.to_numeric(m[col], errors="coerce"), "y": y}).dropna()
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
            }
        )
    # Group by family (log2fc, Boltz, descriptors), sort by |correlation| within.
    feats.sort(
        key=lambda f: (FEATURE_CORR_FAMILY_ORDER[f["family"]], -abs(f["pearson"]))
    )
    _write(
        "feature_corr.json", {"rows": ["Pearson r", "Spearman r"], "features": feats}
    )


def build_shap_families(src: Path) -> None:
    df = pd.read_csv(src.joinpath(*SHAP_FAMILY_CSV))
    fams = [
        {
            "family": str(r["family"]),
            "share": round(float(r["share_abs_shap"]), 4),
            "nSelected": int(r["n_selected"]),
        }
        for _, r in df.iterrows()
    ]
    fams.sort(key=lambda f: f["share"], reverse=True)
    _write("shap_families.json", {"families": fams})


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--src",
        type=Path,
        default=DEFAULT_SRC,
        help="Path to the local pxr-iduction-challenge working repo.",
    )
    args = parser.parse_args()
    src: Path = args.src
    if not src.exists():
        raise SystemExit(f"Source repo not found: {src}")

    logger.info("source repo: %s", src)
    build_leaderboard(src)
    build_phase_metrics(src)
    build_scatter(src)
    build_calibration_bins(src)
    build_ensemble_members(src)
    build_proxy(src)
    build_shap_families(src)
    build_coverage(src)
    build_sankey(src)
    build_topk_sweep(src)
    build_lgbm_gain(src)
    build_lgbm_top_features(src)
    build_member_corr(src)
    build_model_cards(src)
    build_boltz_pooling(src)
    build_calibration_journey(src)
    build_phase2_as2(src)
    build_feature_scatter(src)
    build_feature_corr(src)
    logger.info("done -> %s", OUT_DIR)


if __name__ == "__main__":
    main()
