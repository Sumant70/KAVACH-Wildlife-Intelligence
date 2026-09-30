"""
KAVACH Risk Model Generator
Trains a RandomForest risk classifier on the existing CSV dataset and saves risk_model.pkl
Run: python backend/generate_risk_model.py
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

import pandas as pd
import numpy as np
import joblib
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

CSV_PATH = backend_dir.parent / "ml" / "risk_dataset.csv"
if not CSV_PATH.exists():
    CSV_PATH = backend_dir.parent / "risk_dataset.csv"

OUTPUT_PATH = backend_dir / "risk_model.pkl"

KAVACH_SPECIES = [
    "elephant", "tiger", "leopard", "wild_boar", "dog",
    "spotted_deer", "sloth_bear", "gaur", "rhinoceros",
    "wild_buffalo", "crocodile", "snake", "cobra",
    "indian_python", "russells_viper", "krait"
]


def score_to_level(score: float) -> str:
    if score >= 80:
        return "CRITICAL"
    elif score >= 60:
        return "HIGH"
    elif score >= 35:
        return "MEDIUM"
    else:
        return "LOW"


def generate_synthetic_dataset(n=5000):
    """Generate synthetic risk dataset."""
    rng = np.random.default_rng(42)
    hazard = {
        "elephant": 88, "tiger": 95, "leopard": 90, "wild_boar": 60,
        "dog": 45, "spotted_deer": 25, "sloth_bear": 85, "gaur": 75,
        "rhinoceros": 85, "wild_buffalo": 80, "crocodile": 85,
        "snake": 75, "cobra": 90, "indian_python": 70,
        "russells_viper": 92, "krait": 95
    }
    species = rng.choice(KAVACH_SPECIES, n)
    confidence = rng.uniform(0.30, 0.99, n)
    distance = rng.uniform(50, 5000, n)
    recent = rng.integers(0, 10, n)
    hist = rng.integers(0, 8, n)
    prox = rng.integers(0, 4, n)   # settlement_proximity 0-3
    temporal = rng.integers(0, 3, n)
    environ = rng.integers(0, 4, n)
    spatial = rng.integers(0, 4, n)

    def compute_score(sp, conf, dist, rec, h, p, t, env, spa):
        base = hazard.get(sp, 50) * conf
        if dist < 500:
            base += 20
        elif dist < 1500:
            base += 10
        elif dist > 4000:
            base -= 10
        if t in [1, 2]:  # night/dawn
            base += 8
        if rec > 5:
            base += 5
        if h > 4:
            base += 5
        base = min(100, max(0, base))
        return round(base, 2)

    risk_scores = [compute_score(species[i], confidence[i], distance[i], recent[i],
                                 hist[i], prox[i], temporal[i], environ[i], spatial[i])
                   for i in range(n)]
    risk_levels = [score_to_level(s) for s in risk_scores]

    return pd.DataFrame({
        "species": species,
        "yolo_confidence": confidence * 100,
        "recent_detections": recent,
        "historical_conflicts": hist,
        "settlement_proximity": prox,
        "temporal_pattern": temporal,
        "environmental_context": environ,
        "spatial_relationship": spatial,
        "risk_score": risk_scores,
        "risk_level": risk_levels
    })


def main():
    print("[KAVACH] Generating KAVACH Risk Classification Model...", flush=True)

    if CSV_PATH.exists():
        print(f"[KAVACH] Loading existing dataset from {CSV_PATH}", flush=True)
        try:
            df = pd.read_csv(CSV_PATH)
            print(f"[KAVACH] Loaded {len(df)} rows, columns: {df.columns.tolist()}", flush=True)
        except Exception as e:
            print(f"[KAVACH] CSV error: {e}. Using synthetic.", flush=True)
            df = generate_synthetic_dataset(5000)
    else:
        print("[KAVACH] CSV not found, generating synthetic dataset.", flush=True)
        df = generate_synthetic_dataset(5000)

    # If CSV has risk_score (continuous), derive risk_level
    if "risk_level" not in df.columns and "risk_score" in df.columns:
        df["risk_level"] = df["risk_score"].apply(score_to_level)
        print("[KAVACH] Derived risk_level from risk_score", flush=True)

    if "risk_level" not in df.columns:
        print("[KAVACH] No risk_level column found. Falling back to synthetic data.", flush=True)
        df = generate_synthetic_dataset(5000)

    # Clean
    df["risk_level"] = df["risk_level"].str.upper().str.strip()
    df = df[df["risk_level"].isin(["LOW", "MEDIUM", "HIGH", "CRITICAL"])].dropna()

    print(f"[KAVACH] Cleaned dataset: {len(df)} rows", flush=True)
    print(df["risk_level"].value_counts().to_string(), flush=True)

    # Feature columns
    cat_features = ["species"]
    num_features = []

    for col in ["yolo_confidence", "recent_detections", "historical_conflicts",
                "settlement_proximity", "temporal_pattern", "environmental_context",
                "spatial_relationship", "risk_score"]:
        if col in df.columns:
            num_features.append(col)

    feature_cols = cat_features + num_features

    # Filter to existing columns
    feature_cols = [c for c in feature_cols if c in df.columns]
    cat_features = [c for c in cat_features if c in df.columns]
    num_features = [c for c in num_features if c in df.columns]

    print(f"[KAVACH] Features: cat={cat_features}, num={num_features}", flush=True)

    X = df[feature_cols].copy()
    y = df["risk_level"].copy()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    transformers = []
    if cat_features:
        transformers.append(("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_features))
    if num_features:
        transformers.append(("num", StandardScaler(), num_features))

    preprocessor = ColumnTransformer(transformers=transformers, remainder="drop")

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", RandomForestClassifier(
            n_estimators=200,
            max_depth=12,
            min_samples_leaf=3,
            random_state=42,
            class_weight="balanced"
        ))
    ])

    print("[KAVACH] Training RandomForest classifier...", flush=True)
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    print("\n[KAVACH] Classification Report:", flush=True)
    print(classification_report(y_test, y_pred), flush=True)

    joblib.dump(pipeline, OUTPUT_PATH)
    print(f"\n[KAVACH] ✅ Risk model saved to: {OUTPUT_PATH}", flush=True)

    # Validation
    loaded = joblib.load(OUTPUT_PATH)
    test_pred = loaded.predict(X_test.head(5))
    print(f"[KAVACH] ✅ Loaded model validation: {test_pred}", flush=True)


if __name__ == "__main__":
    main()
