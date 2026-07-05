#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "pandas",
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
MEMBER_LABELS = {
    "cheme_t10_top500": "CheMeleon+2D+Boltz top-500 (TabPFN)",
    "cheme_t10_full": "CheMeleon+2D+Boltz full 2103d (TabPFN)",
    "chemprop_embed": "ChemProp D-MPNN log2fc embed",
    "kermt": "KERMT graph-transformer embed",
    "pooled_boltz": "Boltz-2 trunk (core pocket)",
    "molformer_c3": "MoLFormer-c3 embed",
    "pooled_boltz_allpairs": "Boltz-2 trunk (all pairs)",
    "gatedgcn": "GatedGCN log2fc embed",
    "attentivefp": "AttentiveFP log2fc embed",
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
    df = pd.read_csv(src.joinpath(*MEMBER_REPLAY_CSV))
    pre = df[(df["stage"] == "pre_as1") & (df["production_member"])].copy()
    members = []
    for _, r in pre.iterrows():
        key = str(r["member"])
        weight = r["old_weight"]
        if pd.isna(weight):
            continue
        members.append(
            {
                "key": key,
                "label": MEMBER_LABELS.get(key, key),
                "weight": round(float(weight), 4),
                "standaloneMae": round(float(r["as1_mae"]), 4),
            }
        )
    members.sort(key=lambda m: m["weight"], reverse=True)
    _write(
        "ensemble_members.json",
        {
            # Honest model-only ensemble AS1 MAE for reference (beats every single member).
            "ensembleMae": 0.4077,
            "members": members,
        },
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
    logger.info("done -> %s", OUT_DIR)


if __name__ == "__main__":
    main()
