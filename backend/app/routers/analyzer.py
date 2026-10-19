"""
Spatial-Temporal Risk Analyzer & Factor Decomposition Router.
Provides deep-dive range analysis, factor breakdown ('Why is this ward at risk?'),
inundation progression curves, and CSV dataset download.
"""

import os
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.app.database import get_db
from backend.app.services.weather_service import WeatherInferenceService
from backend.app.data.coimbatore_wards import get_all_coimbatore_wards

router = APIRouter(prefix="/api/analyzer", tags=["Risk Analyzer & Decision Support"])

inference_service = WeatherInferenceService()

@router.get("/range-curve")
def get_range_analysis_curve(
    api_7d_mm: float = Query(100.0, ge=0.0, le=400.0),
    steps: int = Query(7, ge=3, le=10)
):
    """
    Computes progressive flood exposure curves across a rainfall range
    (0 mm to 200 mm) showing transition of wards, area, and population at risk.
    """
    rain_points = [10.0, 30.0, 50.0, 75.0, 100.0, 140.0, 180.0]
    wards = get_all_coimbatore_wards()
    curve_data = []

    for r in rain_points:
        res = inference_service.predict_ward_risks(override_rain_24h=r, override_api_7d=api_7d_mm)
        td = res["tier_distribution"]
        
        # Calculate exposed population and area
        high_risk_wards = [w for w in res["all_wards"] if w["risk_tier"] in ["orange", "red"]]
        exposed_pop = sum(w["population"] for w in high_risk_wards)
        exposed_area = sum(w["area_sqkm"] for w in high_risk_wards)
        
        curve_data.append({
            "rainfall_mm": r,
            "green_count": td["green"],
            "yellow_count": td["yellow"],
            "orange_count": td["orange"],
            "red_count": td["red"],
            "high_risk_wards_count": len(high_risk_wards),
            "exposed_population": exposed_pop,
            "exposed_area_sqkm": round(exposed_area, 2)
        })

    return {
        "api_7d_mm": api_7d_mm,
        "curve": curve_data
    }

@router.get("/ward-why/{ward_id}")
def get_ward_risk_decomposition(ward_id: str, rain_24h_mm: Optional[float] = None):
    """
    Explains WHY a specific ward is at risk.
    Breaks down terrain depression, soil saturation, drainage capacity deficit, and critical hotspots.
    """
    wards = get_all_coimbatore_wards()
    target = next((w for w in wards if w["ward_id"] == ward_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Ward not found")

    # Evaluate current prediction
    pred_res = inference_service.predict_ward_risks(override_rain_24h=rain_24h_mm)
    w_pred = next((w for w in pred_res["all_wards"] if w["ward_id"] == ward_id), None)
    
    prob = w_pred["calibrated_probability"] if w_pred else 0.1
    rain = w_pred["rain_24h_mm"] if w_pred else (rain_24h_mm or 25.0)
    api = w_pred["api_7d_mm"] if w_pred else 35.0

    # Factor 1: Low-Lying Elevation & HAND (Height Above Nearest Drainage)
    hand = target["hand_mean_m"]
    hand_score = round(max(0.0, min(100.0, (10.0 - hand) * 11.5)), 1)
    
    # Factor 2: Wetness Index Accumulation (TWI)
    twi = target["twi_mean"]
    twi_score = round(max(0.0, min(100.0, (twi - 8.0) * 15.0)), 1)
    
    # Factor 3: Proximity to River / Waterbody
    dist = target["drainage_distance_m"]
    drainage_prox_score = round(max(0.0, min(100.0, (1000.0 - dist) / 9.0)), 1)
    
    # Factor 4: Runoff vs Drainage Throughput Deficit
    drain_cap = target["baseline_drainage_capacity_mmhr"]
    runoff_rate = rain / 6.0 # Estimated peak hourly storm runoff
    deficit_score = round(max(0.0, min(100.0, (runoff_rate / max(1.0, drain_cap)) * 80.0)), 1)

    # Specific Local Landmark Context in Coimbatore
    vulnerability_notes = []
    if hand <= 2.8:
        vulnerability_notes.append("Located in an extreme topographical depression (HAND < 2.8m); natural surface water accumulates rapidly.")
    if twi >= 13.0:
        vulnerability_notes.append("High topographic wetness index indicates natural flow convergence zone from surrounding elevated terrain.")
    if dist <= 120:
        vulnerability_notes.append("Directly borders primary municipal drainage or lake buffer (Noyyal river corridor or Sanganoor Pallam stream).")
    if drain_cap <= 25.0:
        vulnerability_notes.append("Known historical bottleneck: railway underpass or low subway with reduced storm drainage throughput.")
    if not vulnerability_notes:
        vulnerability_notes.append("Well-drained higher elevation plateau with adequate natural stormwater discharge gradient.")

    return {
        "ward_id": ward_id,
        "ward_number": target["ward_number"],
        "ward_name": target["ward_name"],
        "zone_name": target["zone_name"],
        "calibrated_flood_probability": prob,
        "risk_tier": w_pred["risk_tier"] if w_pred else "green",
        "factor_breakdown": {
            "hand_depression_score": hand_score,
            "hand_value_m": hand,
            "wetness_convergence_score": twi_score,
            "twi_value": twi,
            "drainage_proximity_score": drainage_prox_score,
            "distance_to_drain_m": dist,
            "storm_drainage_deficit_score": deficit_score,
            "drainage_capacity_mmhr": drain_cap,
            "rainfall_inflow_mm": rain,
            "antecedent_api_mm": api
        },
        "explanatory_findings": vulnerability_notes
    }

@router.get("/comprehensive-report")
def generate_flood_risk_report(
    rain_24h_mm: float = Query(75.0, ge=0.0, le=400.0),
    api_7d_mm: float = Query(110.0, ge=0.0, le=500.0)
):
    """
    Generates a formal, comprehensive flood risk and inundation assessment report
    for Coimbatore City Municipal Corporation and TNSDMA decision support.
    """
    res = inference_service.predict_ward_risks(override_rain_24h=rain_24h_mm, override_api_7d=api_7d_mm)
    all_wards = res["all_wards"]
    td = res["tier_distribution"]

    high_risk_wards = [w for w in all_wards if w["risk_tier"] in ["orange", "red"]]
    moderate_wards = [w for w in all_wards if w["risk_tier"] == "yellow"]

    # Calculate waterlogging depths and infrastructure impacts
    detailed_ward_assessments = []
    for w in sorted(high_risk_wards, key=lambda x: x["calibrated_probability"], reverse=True):
        # Estimated waterlogging depth in cm based on HAND and drainage deficit
        hand = w["hand_m"]
        drain_cap = w["drainage_capacity_mmhr"]
        runoff = w["rain_24h_mm"] / 5.0 # peak hourly runoff estimate
        depth_cm = round(max(15.0, min(140.0, (runoff - drain_cap * 0.4) * 2.8 + (6.0 - hand) * 6.5)), 0)

        # Bottlenecks
        bottlenecks = []
        if hand <= 2.2:
            bottlenecks.append("Severe subway / underpass depression (potential vehicular submergence)")
        if w["twi"] >= 13.5:
            bottlenecks.append("Natural overland flow convergence zone")
        if w["drainage_distance_m"] <= 80:
            bottlenecks.append("Directly adjacent to overflowing primary canal / Noyyal river bank")

        detailed_ward_assessments.append({
            "ward_id": w["ward_id"],
            "ward_number": w["ward_number"],
            "ward_name": w["ward_name"],
            "zone_name": w["zone_name"],
            "risk_tier": w["risk_tier"],
            "probability": w["calibrated_probability"],
            "estimated_waterlogging_depth_cm": depth_cm,
            "population": w["population"],
            "hand_m": hand,
            "drainage_cap_mmhr": drain_cap,
            "primary_bottleneck": bottlenecks[0] if bottlenecks else "Storm drain surcharge"
        })

    # Zone-wise summary
    zone_summary = {}
    for w in all_wards:
        z = w["zone_name"]
        if z not in zone_summary:
            zone_summary[z] = {"total_wards": 0, "red": 0, "orange": 0, "yellow": 0, "green": 0, "exposed_pop": 0}
        zone_summary[z]["total_wards"] += 1
        zone_summary[z][w["risk_tier"]] += 1
        if w["risk_tier"] in ["orange", "red"]:
            zone_summary[z]["exposed_pop"] += w["population"]

    return {
        "report_id": f"REP-CBE-{datetime.utcnow().strftime('%Y%m%d%H%M')}",
        "generated_at": datetime.utcnow().strftime("%d %B %Y, %H:%M UTC"),
        "study_area": "Coimbatore City Municipal Corporation (100 Wards)",
        "meteorological_conditions": {
            "forecast_24h_rainfall_mm": rain_24h_mm,
            "antecedent_precipitation_index_mm": api_7d_mm,
            "storm_classification": "Severe Cloudburst / Heavy Inundation" if rain_24h_mm >= 100 else ("Heavy Monsoonal Spell" if rain_24h_mm >= 65 else "Moderate Pre-Monsoon Showers")
        },
        "executive_summary": (
            f"Under the assessed rainfall intensity of {rain_24h_mm} mm over 24 hours with an antecedent precipitation index of {api_7d_mm} mm, "
            f"a total of {td['red']} wards are placed under RED ALERT (Severe Inundation Imminent) and {td['orange']} wards under ORANGE WARNING. "
            f"An estimated {sum(w['population'] for w in high_risk_wards):,} citizens across {len(high_risk_wards)} low-lying wards are exposed to potential waterlogging. "
            f"Immediate emergency priority is required along the Noyyal River riverfront (Selvapuram, Perur, Ukkadam) and critical railway underpasses (Lanka Corner, Kikani)."
        ),
        "tier_distribution": td,
        "total_exposed_population": sum(w["population"] for w in high_risk_wards),
        "total_inundated_area_sqkm": round(sum(w["area_sqkm"] for w in high_risk_wards), 2),
        "priority_wards_at_risk": detailed_ward_assessments[:15],
        "zone_breakdown": zone_summary,
        "critical_action_recommendations": [
            "Deploy heavy-duty mobile dewatering pumps (100 HP) at Lanka Corner, Kikani underpass, and Sungam bypass.",
            "Issue immediate public traffic diversions for low-lying arterial corridors (Avinashi Road flyover underpass, Trichy Road Sungam).",
            "Pre-position SDRF and municipal rescue teams in Central and East zones adjacent to Valankulam and Singanallur lake overflow margins.",
            "Broadcast targeted emergency SMS alerts to opted-in residents across the flagged RED wards advising movement of vehicles to elevated ground."
        ]
    }

@router.get("/scenario-matrix")
def get_scenario_matrix():
    """
    Returns comparative risk analysis across 5 benchmark storm intensities
    (25mm, 50mm, 85mm, 120mm, 160mm) across all Coimbatore zones.
    """
    scenarios = [
        {"name": "Light-Moderate Showers", "rain_mm": 25.0, "api_mm": 30.0},
        {"name": "Standard Monsoon Day", "rain_mm": 50.0, "api_mm": 65.0},
        {"name": "Intense NE Monsoon (2024 Peak)", "rain_mm": 85.0, "api_mm": 130.0},
        {"name": "Severe Deluge (2021 Benchmark)", "rain_mm": 120.0, "api_mm": 190.0},
        {"name": "100-Year Extreme Cloudburst", "rain_mm": 160.0, "api_mm": 250.0}
    ]

    results = []
    for sc in scenarios:
        res = inference_service.predict_ward_risks(override_rain_24h=sc["rain_mm"], override_api_7d=sc["api_mm"])
        td = res["tier_distribution"]
        high_risk = [w for w in res["all_wards"] if w["risk_tier"] in ["orange", "red"]]
        results.append({
            "scenario_name": sc["name"],
            "rain_24h_mm": sc["rain_mm"],
            "api_7d_mm": sc["api_mm"],
            "red_wards": td["red"],
            "orange_wards": td["orange"],
            "yellow_wards": td["yellow"],
            "green_wards": td["green"],
            "exposed_population": sum(w["population"] for w in high_risk),
            "exposed_area_sqkm": round(sum(w["area_sqkm"] for w in high_risk), 2)
        })

    return {"scenarios": results}

@router.get("/inundation")
@router.get("/inundation-distribution")
def get_ward_inundation_distribution(
    rain_24h_mm: float = Query(65.0, ge=0.0, le=400.0),
    api_7d_mm: float = Query(85.0, ge=0.0, le=500.0)
):
    """
    Dedicated spatial inundation distribution analysis across all 100 wards:
    - Waterlogging depth classification (<15cm, 15-30cm, 30-60cm, >60cm)
    - Ward-by-ward inundated area (sq km) and depth (cm)
    - Exposed population and building density
    - Critical infrastructure vulnerability (underpasses, hospitals, bus stands)
    - Zone-wise depth & area aggregations
    """
    res = inference_service.predict_ward_risks(override_rain_24h=rain_24h_mm, override_api_7d=api_7d_mm)
    all_wards = res["all_wards"]

    # Critical infrastructure knowledge mapping for Coimbatore
    INFRA_MAP = {
        53: ["Lanka Corner Railway Underpass", "Coimbatore Junction East Gate"],
        54: ["Town Hall Commercial Hub", "State Bank Road Subway"],
        55: ["Goods Shed Road Subway", "South Ukkadam Market"],
        56: ["Ukkadam Bus Terminal", "Noyyal River North Sluice"],
        57: ["Sungam Bypass Dip", "Ukkadam Lake Embankment"],
        58: ["Valankulam Lake Bed", "Trichy Road Flyover Ramp"],
        48: ["Kikani School Railway Underpass", "Rathinapuri Stream Bank"],
        47: ["Kaleeswara Mill Road Underpass", "Sivananda Colony Dip"],
        33: ["Singanallur Lake Margin", "Trichy Road Boat House Area"],
        34: ["Singanallur Bus Stand", "Ondipudur Road Dip"],
        11: ["Sanganoor Stream Culvert", "Ganapathy Main Junction"],
        13: ["Ganapathy Pudur Lowland", "Avarampalayam Rail Crossing"],
        74: ["Selvapuram Primary Drain", "Perur High Road Causeway"],
        75: ["Noyyal River Southern Causeway", "Chokkampudur Dip"],
        77: ["Perur Patteeswarar Temple Tank Margin", "Noyyal River Bank"],
        86: ["Kurichi Lake Wetland", "Sundarapuram Junction Underbridge"],
        87: ["Kurichi Tank Overflow Channel", "Palakkad Road Lowland"],
        91: ["Podanur Railway Yard Underpass", "Chettipalayam Road Culvert"]
    }

    wards_inundation = []
    depth_categories = {
        "minor_under_15cm": {"label": "Minor (<15 cm)", "count": 0, "population": 0, "area_sqkm": 0.0},
        "moderate_15_30cm": {"label": "Moderate (15–30 cm)", "count": 0, "population": 0, "area_sqkm": 0.0},
        "severe_30_60cm": {"label": "Severe (30–60 cm)", "count": 0, "population": 0, "area_sqkm": 0.0},
        "extreme_over_60cm": {"label": "Extreme (>60 cm)", "count": 0, "population": 0, "area_sqkm": 0.0}
    }

    zone_stats = {}

    for w in all_wards:
        hand = w["hand_m"]
        drain_cap = w["drainage_capacity_mmhr"]
        rain = w["rain_24h_mm"]
        prob = w["calibrated_probability"]
        pop = w["population"]
        area = w["area_sqkm"]
        w_num = w["ward_number"]
        zone = w["zone_name"]

        # Physics-based waterlogging depth calculation
        # Runoff generated above drainage threshold ponding in low HAND depression
        hourly_runoff = rain / 5.5
        surplus = max(0.0, hourly_runoff - (drain_cap * 0.35))
        depression_factor = max(0.2, (5.5 - hand) * 1.4)
        depth_cm = round(max(3.0, (surplus * 2.2 * depression_factor) + (prob * 18.0)), 1)
        if prob < 0.25:
            depth_cm = round(min(depth_cm, 12.0), 1)

        # Categorize
        if depth_cm < 15.0:
            cat_key = "minor_under_15cm"
            cat_label = "Minor / Street Film"
            inundated_fraction = 0.04
        elif depth_cm <= 30.0:
            cat_key = "moderate_15_30cm"
            cat_label = "Moderate (Kerb Level)"
            inundated_fraction = 0.18
        elif depth_cm <= 60.0:
            cat_key = "severe_30_60cm"
            cat_label = "Severe (Vehicular Stalling)"
            inundated_fraction = 0.42
        else:
            cat_key = "extreme_over_60cm"
            cat_label = "Critical (Submergence / Pump Req.)"
            inundated_fraction = 0.70

        inundated_area = round(area * inundated_fraction, 2)
        exposed_pop = int(pop * inundated_fraction)
        exposed_buildings = int(exposed_pop / 4.2)

        depth_categories[cat_key]["count"] += 1
        depth_categories[cat_key]["population"] += exposed_pop
        depth_categories[cat_key]["area_sqkm"] = round(depth_categories[cat_key]["area_sqkm"] + inundated_area, 2)

        # Aggregate zone
        if zone not in zone_stats:
            zone_stats[zone] = {
                "zone_name": zone,
                "total_wards": 0,
                "severe_or_critical_wards": 0,
                "total_inundated_sqkm": 0.0,
                "total_exposed_pop": 0
            }
        zone_stats[zone]["total_wards"] += 1
        if depth_cm >= 30.0:
            zone_stats[zone]["severe_or_critical_wards"] += 1
        zone_stats[zone]["total_inundated_sqkm"] = round(zone_stats[zone]["total_inundated_sqkm"] + inundated_area, 2)
        zone_stats[zone]["total_exposed_pop"] += exposed_pop

        wards_inundation.append({
            "ward_id": w["ward_id"],
            "ward_number": w_num,
            "ward_name": w["ward_name"],
            "zone_name": zone,
            "risk_tier": w["risk_tier"],
            "probability": prob,
            "rain_24h_mm": rain,
            "waterlogging_depth_cm": depth_cm,
            "depth_category": cat_key,
            "depth_label": cat_label,
            "inundated_area_sqkm": inundated_area,
            "total_ward_area_sqkm": area,
            "exposed_population": exposed_pop,
            "total_population": pop,
            "exposed_buildings": exposed_buildings,
            "hand_m": hand,
            "twi": w["twi"],
            "drainage_cap_mmhr": drain_cap,
            "critical_facilities": INFRA_MAP.get(w_num, ["Local secondary drains"])
        })

    # Sort descending by waterlogging depth
    wards_inundation_sorted = sorted(wards_inundation, key=lambda x: x["waterlogging_depth_cm"], reverse=True)

    return {
        "assessment_rainfall_mm": rain_24h_mm,
        "assessment_api_mm": api_7d_mm,
        "total_wards": len(all_wards),
        "depth_categories": depth_categories,
        "zone_summary": list(zone_stats.values()),
        "total_city_inundated_sqkm": round(sum(c["area_sqkm"] for c in depth_categories.values()), 2),
        "total_city_exposed_population": sum(c["population"] for c in depth_categories.values()),
        "all_wards_inundation": wards_inundation_sorted
    }

@router.get("/dataset-info")
def get_master_dataset_metadata():
    csv_path = "data_store/coimbatore_master_flood_dataset_2015_2024.csv"
    weather_csv = "data_store/coimbatore_daily_weather_archive_2015_2024.csv"
    file_size_mb = round(os.path.getsize(csv_path) / (1024 * 1024), 2) if os.path.exists(csv_path) else 0.0

    return {
        "dataset_name": "Coimbatore 10-Year Master Flood Dataset (2015-2024)",
        "source": "Open-Meteo Historical Archive API + CCMC Waterlogging Registers + Copernicus GLO-30 DEM",
        "total_records": 202000,
        "time_period": "2015-01-01 to 2024-12-31 (10 Years Continuous)",
        "daily_weather_days": 3653,
        "file_size_mb": file_size_mb,
        "features": [
            "date", "ward_id", "ward_number", "ward_name", "zone_name",
            "rain_1d_mm", "rain_3d_mm", "rain_7d_mm", "api_mm", "soil_moisture",
            "elevation_m", "hand_m", "twi", "slope_deg", "drainage_distance_m",
            "drainage_cap_mmhr", "flood_label"
        ],
        "download_url": "/api/analyzer/download-master-csv"
    }

@router.get("/download-master-csv")
def download_master_csv():
    """Streams the full 10-year CSV dataset to the user."""
    csv_path = "data_store/coimbatore_master_flood_dataset_2015_2024.csv"
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail="Dataset file not found.")
    return FileResponse(
        csv_path,
        media_type="text/csv",
        filename="coimbatore_master_flood_dataset_2015_2024.csv"
    )

@router.get("/download-weather-csv")
def download_weather_csv():
    """Streams the 10-year daily weather observations archive CSV."""
    weather_csv = "data_store/coimbatore_daily_weather_archive_2015_2024.csv"
    if not os.path.exists(weather_csv):
        raise HTTPException(status_code=404, detail="Weather archive file not found.")
    return FileResponse(
        weather_csv,
        media_type="text/csv",
        filename="coimbatore_daily_weather_archive_2015_2024.csv"
    )

@router.get("/model-evaluation")
def get_model_evaluation_metrics():
    """Returns operational model metrics and benchmark comparison."""
    import json
    metrics_path = "ml/models/model_metrics.json"
    if os.path.exists(metrics_path):
        with open(metrics_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"status": "pending", "message": "Model evaluation metrics file not generated yet."}

