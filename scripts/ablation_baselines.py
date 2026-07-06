#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "pandas",
#     "pyarrow",
#     "numpy",
#     "lightgbm",
#     "scikit-learn",
#     "rdkit",
# ]
# ///
"""Single-signal ablation: how far do simple baselines get on the blinded test?

Fits three deliberately simple models on the training pEC50 and evaluates them on
the now-unblinded test set (AS1 + AS2, 513 compounds):

1. pred-only        : linear fit on the two predicted-log2fc columns.
2. Boltz-aff-only   : linear fit on the Boltz-2 affinity score.
3. RDKit-only LGBM  : default LightGBM on the full RDKit descriptor set.

The point is context, not a production pipeline: two predicted-log2fc columns via
a plain linear fit roughly match a 217-descriptor untuned LightGBM, and clearly
beat the Boltz-2 affinity score. Writes docs/assets/data/baselines.json.

Usage:  ./scripts/ablation_baselines.py [--src /path/to/pxr-iduction-challenge]
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from rdkit import Chem, RDLogger
from rdkit.Chem import Descriptors

RDLogger.DisableLog("rdApp.*")
np.seterr(all="ignore")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("ablation_baselines")

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = REPO_ROOT.joinpath("docs", "assets", "data", "baselines.json")
DEFAULT_SRC = Path("/home/nagaet/pxr-iduction-challenge")

MASTER = ("data", "eda_redo", "master.parquet")
PLOG2FC = ("data", "ensemble4_log2fc_predictions.parquet")
AS1_CSV = (
    "data",
    "hf_pxr_challenge_train_test",
    "pxr-challenge_TEST_PHASE_1_UNBLINDED.csv",
)
AS2_CSV = (
    "data",
    "hf_pxr_challenge_train_test",
    "pxr-challenge_TEST_PHASE_2_UNBLINDED.csv",
)

# Full-system reference numbers (the two graded submissions).
FULL_REFERENCE = {
    "name": "Phase 1 (my final submission)",
    "nFeatures": "~2,100",
    "maeAll": 0.4059,
    "maeAs2": 0.4113,
    "spearmanAll": 0.8343,
}

_DESCS = Descriptors._descList
_DESC_NAMES = [n for n, _ in _DESCS]


def _rdkit_descriptors(smiles: pd.Series) -> pd.DataFrame:
    rows = []
    for smi in smiles:
        mol = Chem.MolFromSmiles(smi)
        if mol is None:
            rows.append([np.nan] * len(_DESCS))
            continue
        vals = []
        for _, fn in _DESCS:
            try:
                vals.append(fn(mol))
            except Exception:
                vals.append(np.nan)
        rows.append(vals)
    return (
        pd.DataFrame(rows, columns=_DESC_NAMES)
        .replace([np.inf, -np.inf], np.nan)
        .fillna(0.0)
    )


def _spearman(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.corrcoef(pd.Series(a).rank(), pd.Series(b).rank())[0, 1])


def _metrics(y: np.ndarray, yhat: np.ndarray) -> dict:
    y = np.asarray(y, float)
    yhat = np.asarray(yhat, float)
    mae = float(np.mean(np.abs(yhat - y)))
    r2 = float(1 - np.sum((yhat - y) ** 2) / np.sum((y - y.mean()) ** 2))
    return {
        "mae": round(mae, 4),
        "r2": round(r2, 4),
        "spearman": round(_spearman(y, yhat), 4),
    }


def _linfit(df: pd.DataFrame, cols: list[str]) -> np.ndarray:
    design = np.column_stack([np.ones(len(df))] + [df[c].to_numpy() for c in cols])
    beta, *_ = np.linalg.lstsq(design, df["y"].to_numpy(), rcond=None)
    return beta


def _linpred(df: pd.DataFrame, cols: list[str], beta: np.ndarray) -> np.ndarray:
    design = np.column_stack([np.ones(len(df))] + [df[c].to_numpy() for c in cols])
    return design @ beta


def _load(src: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    m = pd.read_parquet(src.joinpath(*MASTER))
    pred = pd.read_parquet(src.joinpath(*PLOG2FC))
    m = m.merge(pred, left_on="compound_id", right_index=True, how="left")
    train = (
        m[m["in_train"].fillna(False)]
        .dropna(subset=["train_pec50"])
        .rename(columns={"train_pec50": "y"})
    )
    as1 = pd.read_csv(src.joinpath(*AS1_CSV)).assign(set="AS1")
    as2 = pd.read_csv(src.joinpath(*AS2_CSV)).assign(set="AS2")
    truth = pd.concat(
        [as1[["SMILES", "pEC50", "set"]], as2[["SMILES", "pEC50", "set"]]],
        ignore_index=True,
    )
    bridge = m[m["in_test"].fillna(False)][
        ["smiles", "log2fc_8p25_pred", "log2fc_33_pred", "b2_affinity_pred"]
    ]
    test = truth.merge(bridge, left_on="SMILES", right_on="smiles", how="inner").rename(
        columns={"pEC50": "y"}
    )
    logger.info("train=%d  test matched=%d / %d", len(train), len(test), len(truth))
    return train, test


def _row(name: str, n_features, test: pd.DataFrame, yhat: np.ndarray) -> dict:
    d = test.assign(yhat=yhat)
    all_m = _metrics(d["y"], d["yhat"])
    as2 = d[d["set"] == "AS2"]
    as2_m = _metrics(as2["y"], as2["yhat"])
    return {
        "name": name,
        "nFeatures": n_features,
        "maeAll": all_m["mae"],
        "maeAs2": as2_m["mae"],
        "spearmanAll": all_m["spearman"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--src", type=Path, default=DEFAULT_SRC)
    args = parser.parse_args()
    train, test = _load(args.src)

    rows = []

    for col, name in (
        ("log2fc_8p25_pred", "pred 8.25 µM only (linear)"),
        ("log2fc_33_pred", "pred 33 µM only (linear)"),
    ):
        beta = _linfit(train.dropna(subset=[col]), [col])
        rows.append(_row(name, 1, test, _linpred(test, [col], beta)))

    pred_cols = ["log2fc_8p25_pred", "log2fc_33_pred"]
    beta = _linfit(train.dropna(subset=pred_cols), pred_cols)
    rows.append(_row("pred (both), linear", 2, test, _linpred(test, pred_cols, beta)))

    tr_b = train.dropna(subset=["b2_affinity_pred"])
    te_b = test.dropna(subset=["b2_affinity_pred"])
    beta = _linfit(tr_b, ["b2_affinity_pred"])
    rows.append(
        _row(
            "Boltz-2 affinity-only (linear)",
            1,
            te_b,
            _linpred(te_b, ["b2_affinity_pred"], beta),
        )
    )

    x_train = _rdkit_descriptors(train["smiles"])
    x_test = _rdkit_descriptors(test["SMILES"])
    model = lgb.LGBMRegressor(verbose=-1)
    model.fit(x_train, train["y"].to_numpy())
    rows.append(
        _row(
            "RDKit descriptors, untuned LightGBM",
            x_train.shape[1],
            test,
            model.predict(x_test),
        )
    )

    payload = {
        "note": "Fit on training pEC50, evaluated on the unblinded test (AS1 + AS2).",
        "baselines": rows,
        "reference": FULL_REFERENCE,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    logger.info("wrote %s", OUT_PATH)
    for r in rows + [FULL_REFERENCE]:
        logger.info(
            "%-38s feat=%-6s MAE(all)=%.4f MAE(AS2)=%.4f Spearman=%.4f",
            r["name"],
            str(r["nFeatures"]),
            r["maeAll"],
            r["maeAs2"],
            r["spearmanAll"],
        )


if __name__ == "__main__":
    main()
