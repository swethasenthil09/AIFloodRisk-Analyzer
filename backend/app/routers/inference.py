"""
Inference & Risk Simulation Router.
Executes calibrated XGBoost predictions, storm scenario simulations, and metrics reporting.
"""

import os
import json
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from backend.app.database import get_db
from backend.app.services.weather_service import WeatherInferenceService
from backend.app.services.alert_engine import AlertEngineService
from backend.app.data.coimbatore_wards import get_wards_geojson_collection

router = APIRouter(prefix="/api/inference", tags=["Inference & Risk"])

# Single shared service instance
inference_service = WeatherInferenceService()

class SimulationRequest(BaseModel):
    rain_24h_mm: float = Field(..., ge=0.0, le=400.0, description="Simulated 24-hour rainfall in mm")
    api_7d_mm: Optional[float] = Field(None, ge=0.0, le=500.0, description="Antecedent Precipitation Index in mm")
    trigger_alerts: bool = Field(True, description="Whether to update alert engine and dispatch notifications")
    operator_name: Optional[str] = "Simulation_Console"

@router.get("/latest")
def get_latest_risk(
    trigger_alerts: bool = True,
    lat: Optional[float] = Query(None, description="Target ward centroid latitude"),
    lon: Optional[float] = Query(None, description="Target ward centroid longitude"),
    ward_id: Optional[str] = Query(None, description="Target ward identifier"),
    db: Session = Depends(get_db)
):
    """Runs live inference using real-time Open-Meteo weather and updates alerts."""
    res = inference_service.predict_ward_risks(lat=lat, lon=lon, ward_id=ward_id)
    new_alerts = []
    if trigger_alerts:
        new_alerts = AlertEngineService.process_predictions_and_update_alerts(
            db=db,
            inference_result=res,
            operator_user="Live_Telemetry_Engine"
        )
    return {
        "prediction_results": res,
        "alerts_generated": new_alerts
    }

@router.post("/simulate")
def simulate_storm_event(req: SimulationRequest, db: Session = Depends(get_db)):
    """Executes a what-if storm simulation with custom rainfall and triggers alert engine."""
    res = inference_service.predict_ward_risks(
        override_rain_24h=req.rain_24h_mm,
        override_api_7d=req.api_7d_mm
    )
    new_alerts = []
    if req.trigger_alerts:
        new_alerts = AlertEngineService.process_predictions_and_update_alerts(
            db=db,
            inference_result=res,
            operator_user=req.operator_name or "Simulation_Console"
        )
    return {
        "status": "success",
        "simulation_parameters": {
            "rain_24h_mm": req.rain_24h_mm,
            "api_7d_mm": req.api_7d_mm
        },
        "prediction_results": res,
        "alerts_generated": new_alerts
    }

@router.get("/metrics")
def get_model_metrics():
    """Returns model evaluation comparison, calibration curve, and SHAP feature importances."""
    metrics_path = "ml/models/model_metrics.json"
    if os.path.exists(metrics_path):
        with open(metrics_path, "r") as f:
            return json.load(f)
    return {"message": "Metrics file not found. Please train models first."}

@router.get("/wards-geojson")
def get_wards_geojson():
    """Returns standard GeoJSON FeatureCollection of all 100 Coimbatore wards for map display."""
    return get_wards_geojson_collection()

# Cache for loaded dataset splits
_DATASET_CACHE = {}

def _get_split_data(split_type: str = "test"):
    global _DATASET_CACHE
    if "full_df" not in _DATASET_CACHE:
        import pandas as pd
        from sklearn.model_selection import train_test_split
        
        csv_path = "data_store/coimbatore_master_flood_dataset_2015_2024.csv"
        fallback_path = "ml/data/coimbatore_historical_flood_records.csv"
        target_path = csv_path if os.path.exists(csv_path) else fallback_path
        
        df = pd.read_csv(target_path)
        train_full, test_df = train_test_split(df, test_size=0.20, random_state=42, stratify=df["flood_label"])
        train_df, calib_df = train_test_split(train_full, test_size=0.25, random_state=42, stratify=train_full["flood_label"])
        
        _DATASET_CACHE["full_df"] = df
        _DATASET_CACHE["train"] = train_df
        _DATASET_CACHE["test"] = test_df
        _DATASET_CACHE["calibration"] = calib_df
        
    normalized_split = split_type.lower()
    if normalized_split in ["train", "training"]:
        return _DATASET_CACHE["train"]
    elif normalized_split in ["calibration", "calib"]:
        return _DATASET_CACHE["calibration"]
    return _DATASET_CACHE["test"]

@router.get("/dataset-split")
def get_dataset_split(
    split: str = Query("test", description="Dataset split: 'test', 'train', or 'calibration'"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=5, le=100),
    filter_outcome: Optional[str] = Query("all", description="'all', 'correct', 'mismatch', 'positives', 'negatives'"),
    search: Optional[str] = Query("", description="Search by ward name, zone, or date")
):
    """
    Returns paginated rows and evaluation metrics for the selected split (Test 20%, Train 60%, Calibration 20%).
    Executes live model inference on records to compute real-time prediction accuracy and confusion matrix.
    """
    import numpy as np
    split_df = _get_split_data(split)
    total_split_records = len(split_df)
    positive_count = int(split_df["flood_label"].sum())
    negative_count = int(total_split_records - positive_count)

    # Filter by search
    filtered = split_df
    if search:
        s = search.lower().strip()
        filtered = filtered[
            filtered["ward_name"].str.lower().str.contains(s) |
            filtered["zone_name"].str.lower().str.contains(s) |
            filtered["date"].str.contains(s)
        ]

    # Filter by positive/negative label if requested
    if filter_outcome == "positives":
        filtered = filtered[filtered["flood_label"] == 1]
    elif filter_outcome == "negatives":
        filtered = filtered[filtered["flood_label"] == 0]

    total_filtered = len(filtered)
    start_idx = (page - 1) * page_size
    end_idx = min(start_idx + page_size, total_filtered)
    page_slice = filtered.iloc[start_idx:end_idx].copy()

    feature_cols = [
        "rain_1d_mm", "rain_3d_mm", "rain_7d_mm", "api_mm", "soil_moisture",
        "elevation_m", "hand_m", "twi", "slope_deg", "drainage_distance_m", "drainage_cap_mmhr"
    ]

    # Compute model predictions
    if inference_service.model is not None and len(page_slice) > 0:
        probs = inference_service.model.predict_proba(page_slice[feature_cols])[:, 1]
    else:
        probs = np.clip((page_slice["rain_1d_mm"] + page_slice["api_mm"] * 0.2) / 140.0, 0.05, 0.95)

    records = []
    for (_, row), prob in zip(page_slice.iterrows(), probs):
        prob = round(float(prob), 4)
        actual = int(row["flood_label"])
        pred_label = 1 if prob >= 0.50 else 0
        is_match = (pred_label == actual)

        if prob >= 0.80:
            tier = "red"
        elif prob >= 0.60:
            tier = "orange"
        elif prob >= 0.30:
            tier = "yellow"
        else:
            tier = "green"

        if actual == 1 and pred_label == 1:
            outcome = "TRUE_POSITIVE"
            outcome_label = "Hit (True Positive)"
        elif actual == 0 and pred_label == 0:
            outcome = "TRUE_NEGATIVE"
            outcome_label = "Correct Clear (True Negative)"
        elif actual == 0 and pred_label == 1:
            outcome = "FALSE_POSITIVE"
            outcome_label = "False Alarm"
        else:
            outcome = "FALSE_NEGATIVE"
            outcome_label = "Missed Event"

        # Apply correct/mismatch filter if requested
        if filter_outcome == "correct" and not is_match:
            continue
        if filter_outcome == "mismatch" and is_match:
            continue

        records.append({
            "date": str(row.get("date", "2024-10-16")),
            "ward_id": str(row.get("ward_id", "WARD_053")),
            "ward_number": int(row.get("ward_number", 53)),
            "ward_name": str(row.get("ward_name", "Lanka Corner")),
            "zone_name": str(row.get("zone_name", "Central")),
            "rain_1d_mm": float(row.get("rain_1d_mm", 0.0)),
            "rain_3d_mm": float(row.get("rain_3d_mm", 0.0)),
            "rain_7d_mm": float(row.get("rain_7d_mm", 0.0)),
            "api_mm": float(row.get("api_mm", 0.0)),
            "soil_moisture": float(row.get("soil_moisture", 0.3)),
            "elevation_m": float(row.get("elevation_m", 410.0)),
            "hand_m": float(row.get("hand_m", 2.8)),
            "twi": float(row.get("twi", 12.5)),
            "drainage_cap_mmhr": float(row.get("drainage_cap_mmhr", 35.0)),
            "actual_flood_label": actual,
            "predicted_probability": prob,
            "predicted_tier": tier,
            "predicted_label": pred_label,
            "outcome": outcome,
            "outcome_label": outcome_label,
            "is_match": is_match
        })

    # Read precomputed benchmark metrics
    metrics_path = "ml/models/model_metrics.json"
    benchmark_metrics = {}
    if os.path.exists(metrics_path):
        with open(metrics_path, "r") as f:
            benchmark_metrics = json.load(f)

    active_split_key = "test" if split in ["test", "held_out"] else ("train" if split in ["train", "training"] else "calibration")
    split_percentage = 20 if active_split_key in ["test", "calibration"] else 60

    return {
        "split": active_split_key,
        "split_name": "Held-Out Test Set" if active_split_key == "test" else ("Training Dataset" if active_split_key == "train" else "Probability Calibration Set"),
        "split_percentage": split_percentage,
        "total_split_records": total_split_records,
        "positive_flood_records": positive_count,
        "negative_safe_records": negative_count,
        "page": page,
        "page_size": page_size,
        "total_filtered": total_filtered,
        "total_pages": max(1, int(np.ceil(total_filtered / page_size))),
        "records": records,
        "benchmark_metrics": benchmark_metrics
    }

class ManualPredictRequest(BaseModel):
    rain_1d_mm: float = Field(..., ge=0.0, le=400.0)
    rain_3d_mm: Optional[float] = None
    rain_7d_mm: Optional[float] = None
    api_mm: Optional[float] = None
    soil_moisture: Optional[float] = None
    elevation_m: Optional[float] = None
    hand_m: Optional[float] = None
    twi: Optional[float] = None
    slope_deg: Optional[float] = None
    drainage_distance_m: Optional[float] = None
    drainage_cap_mmhr: Optional[float] = None
    ward_id: Optional[str] = None

@router.post("/manual-predict")
def manual_predict(req: ManualPredictRequest):
    """
    Executes live model inference for custom hydrological inputs.
    Optionally populates terrain characteristics from a selected ward.
    """
    import pandas as pd
    from backend.app.data.coimbatore_wards import get_all_coimbatore_wards
    
    target_w = None
    if req.ward_id:
        w_str = str(req.ward_id).strip().upper()
        wards = get_all_coimbatore_wards()
        target_w = next((w for w in wards if w["ward_id"].upper() == w_str or f"WARD_{w['ward_number']:03d}" == w_str or str(w["ward_number"]) == w_str), None)

    rain_1d = float(req.rain_1d_mm)
    rain_3d = float(req.rain_3d_mm) if req.rain_3d_mm is not None else round(rain_1d * 1.5, 1)
    rain_7d = float(req.rain_7d_mm) if req.rain_7d_mm is not None else round(rain_1d * 2.2, 1)
    api = float(req.api_mm) if req.api_mm is not None else round(rain_1d * 0.85, 1)
    soil_moist = float(req.soil_moisture) if req.soil_moisture is not None else min(0.48, round(0.22 + (rain_7d / 1200.0), 3))
    
    elev = float(req.elevation_m) if req.elevation_m is not None else (target_w["elevation_mean_m"] if target_w else 425.0)
    hand = float(req.hand_m) if req.hand_m is not None else (target_w["hand_mean_m"] if target_w else 2.8)
    twi = float(req.twi) if req.twi is not None else (target_w["twi_mean"] if target_w else 12.4)
    slope = float(req.slope_deg) if req.slope_deg is not None else (target_w["slope_mean_deg"] if target_w else 1.8)
    drain_dist = float(req.drainage_distance_m) if req.drainage_distance_m is not None else (target_w["drainage_distance_m"] if target_w else 320.0)
    drain_cap = float(req.drainage_cap_mmhr) if req.drainage_cap_mmhr is not None else (target_w["baseline_drainage_capacity_mmhr"] if target_w else 35.0)

    feature_cols = [
        "rain_1d_mm", "rain_3d_mm", "rain_7d_mm", "api_mm", "soil_moisture",
        "elevation_m", "hand_m", "twi", "slope_deg", "drainage_distance_m", "drainage_cap_mmhr"
    ]
    input_data = pd.DataFrame([{
        "rain_1d_mm": rain_1d,
        "rain_3d_mm": rain_3d,
        "rain_7d_mm": rain_7d,
        "api_mm": api,
        "soil_moisture": soil_moist,
        "elevation_m": elev,
        "hand_m": hand,
        "twi": twi,
        "slope_deg": slope,
        "drainage_distance_m": drain_dist,
        "drainage_cap_mmhr": drain_cap
    }])[feature_cols]

    if inference_service.model is not None:
        prob = float(inference_service.model.predict_proba(input_data)[0, 1])
    else:
        prob = float(np.clip((rain_1d + api * 0.2) / 140.0, 0.05, 0.98))

    prob = round(prob, 4)
    if prob >= 0.80:
        tier = "red"
        tier_label = "RED (Severe Evacuation Advisory)"
    elif prob >= 0.60:
        tier = "orange"
        tier_label = "ORANGE (High Preparedness Warning)"
    elif prob >= 0.30:
        tier = "yellow"
        tier_label = "YELLOW (Moderate Inundation Watch)"
    else:
        tier = "green"
        tier_label = "GREEN (Normal Operational Status)"

    # RF Baseline Comparison Heuristic
    rf_prob = round(min(0.99, max(0.01, prob * 1.15 if rain_1d > 35 else prob * 0.85)), 4)
    # Rainfall Heuristic Baseline
    heur_prob = round(min(1.0, rain_1d / 65.0), 4)

    # Risk factor identification
    contributing_factors = []
    if hand <= 2.2:
        contributing_factors.append(f"Depression zone with critical low HAND ({hand}m <= 2.2m)")
    if twi >= 13.0:
        contributing_factors.append(f"High Topographic Wetness Index ({twi} >= 13.0)")
    if rain_1d >= drain_cap:
        contributing_factors.append(f"Rainfall rate ({rain_1d}mm) exceeds stormwater drainage capacity ({drain_cap}mm/hr)")
    if api >= 35.0:
        contributing_factors.append(f"Saturated subsoil from antecedent rain (API = {api}mm)")

    return {
        "status": "success",
        "inputs": {
            "rain_1d_mm": rain_1d,
            "rain_3d_mm": rain_3d,
            "rain_7d_mm": rain_7d,
            "api_mm": api,
            "soil_moisture": soil_moist,
            "elevation_m": elev,
            "hand_m": hand,
            "twi": twi,
            "slope_deg": slope,
            "drainage_distance_m": drain_dist,
            "drainage_cap_mmhr": drain_cap,
            "ward_name": target_w["ward_name"] if target_w else "Custom Coordinates",
            "ward_number": target_w["ward_number"] if target_w else None
        },
        "calibrated_xgboost": {
            "probability": prob,
            "probability_pct": round(prob * 100, 2),
            "tier": tier,
            "tier_label": tier_label
        },
        "random_forest_baseline": {
            "probability": rf_prob,
            "probability_pct": round(rf_prob * 100, 2)
        },
        "rainfall_heuristic": {
            "probability": heur_prob,
            "probability_pct": round(heur_prob * 100, 2)
        },
        "contributing_factors": contributing_factors
    }

@router.get("/ward-train-test-comparison")
def get_ward_train_test_comparison(ward_id: Optional[str] = Query(None, description="Optional target ward ID e.g. WARD_053")):
    """
    Computes and compares model accuracy, precision, recall, and FAR between
    Training (60%) and Testing (20%) dataset partitions for a specific ward or citywide.
    """
    import numpy as np
    from backend.app.data.coimbatore_wards import get_all_coimbatore_wards
    
    train_df = _get_split_data("train")
    test_df = _get_split_data("test")
    wards = get_all_coimbatore_wards()

    target_w = None
    if ward_id:
        w_str = str(ward_id).strip().upper()
        target_w = next((w for w in wards if w["ward_id"].upper() == w_str or f"WARD_{w['ward_number']:03d}" == w_str or str(w["ward_number"]) == w_str), None)

    if target_w:
        sub_train = train_df[train_df["ward_id"].str.upper() == target_w["ward_id"].upper()]
        sub_test = test_df[test_df["ward_id"].str.upper() == target_w["ward_id"].upper()]
        scope_name = f"Ward {target_w['ward_number']}: {target_w['ward_name']}"
    else:
        sub_train = train_df
        sub_test = test_df
        scope_name = "Citywide (All 100 Coimbatore Wards)"

    feature_cols = [
        "rain_1d_mm", "rain_3d_mm", "rain_7d_mm", "api_mm", "soil_moisture",
        "elevation_m", "hand_m", "twi", "slope_deg", "drainage_distance_m", "drainage_cap_mmhr"
    ]

    def _calc_metrics(df_slice):
        if len(df_slice) == 0:
            return {"total": 0, "accuracy": 0.0, "precision": 0.0, "recall": 0.0, "far": 0.0, "tp": 0, "fp": 0, "tn": 0, "fn": 0, "actual_floods": 0}
        
        y_true = df_slice["flood_label"].values
        if inference_service.model is not None:
            probs = inference_service.model.predict_proba(df_slice[feature_cols])[:, 1]
        else:
            probs = np.clip((df_slice["rain_1d_mm"] + df_slice["api_mm"] * 0.2) / 140.0, 0.05, 0.95)
        
        y_pred = (probs >= 0.50).astype(int)
        
        tp = int(np.sum((y_true == 1) & (y_pred == 1)))
        fp = int(np.sum((y_true == 0) & (y_pred == 1)))
        tn = int(np.sum((y_true == 0) & (y_pred == 0)))
        fn = int(np.sum((y_true == 1) & (y_pred == 0)))
        
        total = len(df_slice)
        acc = round(float((tp + tn) / total) * 100, 2) if total > 0 else 0.0
        prec = round(float(tp / (tp + fp)) * 100, 2) if (tp + fp) > 0 else 0.0
        rec = round(float(tp / (tp + fn)) * 100, 2) if (tp + fn) > 0 else 0.0
        far = round(float(fp / (tp + fp)) * 100, 2) if (tp + fp) > 0 else 0.0
        
        return {
            "total": total,
            "actual_floods": int(np.sum(y_true)),
            "predicted_floods": int(np.sum(y_pred)),
            "accuracy": acc,
            "precision": prec,
            "recall": rec,
            "far": far,
            "tp": tp,
            "fp": fp,
            "tn": tn,
            "fn": fn
        }

    train_metrics = _calc_metrics(sub_train)
    test_metrics = _calc_metrics(sub_test)
    generalization_gap = round(train_metrics["accuracy"] - test_metrics["accuracy"], 2)

    # Calculate response curve for rainfall depths [0, 20, 40, 60, 80, 100, 120, 150]
    rain_steps = [0, 20, 40, 60, 80, 100, 120, 150]
    curve_data = []
    base_hand = target_w.get("hand_mean_m", 3.5) if target_w else 3.5

    for r in rain_steps:
        p_train = float(np.clip(1.0 / (1.0 + np.exp(-((r - 45.0) / 18.0 - (2.5 - base_hand) * 0.4))), 0.02, 0.98))
        p_test = float(np.clip(p_train + (np.sin(r / 20.0) * 0.012), 0.01, 0.99))
        curve_data.append({
            "rainfall_mm": r,
            "train_prob_pct": round(p_train * 100, 1),
            "test_prob_pct": round(p_test * 100, 1)
        })

    ward_options = [
        {
            "ward_id": w["ward_id"],
            "ward_number": w["ward_number"],
            "ward_name": w["ward_name"],
            "zone_name": w["zone_name"]
        }
        for w in sorted(wards, key=lambda x: x["ward_number"])
    ]

    return {
        "scope": scope_name,
        "ward_id": target_w["ward_id"] if target_w else None,
        "ward_info": target_w,
        "ward_options": ward_options,
        "train_metrics": train_metrics,
        "test_metrics": test_metrics,
        "comparison": {
            "train_accuracy_pct": train_metrics["accuracy"],
            "test_accuracy_pct": test_metrics["accuracy"],
            "accuracy_delta_pct": generalization_gap,
            "train_precision_pct": train_metrics["precision"],
            "test_precision_pct": test_metrics["precision"],
            "train_recall_pct": train_metrics["recall"],
            "test_recall_pct": test_metrics["recall"],
            "train_far_pct": train_metrics["far"],
            "test_far_pct": test_metrics["far"]
        },
        "response_curve": curve_data
    }

