from typing import Optional
from fastapi import APIRouter, Query
from backend.app.services.weather_service import WeatherInferenceService
from backend.app.data.coimbatore_wards import get_all_coimbatore_wards

router = APIRouter(prefix="/api/weather", tags=["Weather Telemetry"])

weather_service = WeatherInferenceService()

@router.get("/live")
def get_live_weather(
    lat: Optional[float] = Query(None, description="Target ward centroid latitude"),
    lon: Optional[float] = Query(None, description="Target ward centroid longitude"),
    ward_id: Optional[str] = Query(None, description="Target ward identifier")
):
    """Fetches real-time weather and 7-day antecedent telemetry for Coimbatore or a specific selected ward."""
    target_lat = lat or 11.0168
    target_lon = lon or 76.9558
    telemetry = weather_service.fetch_live_weather(lat=target_lat, lon=target_lon, ward_id=ward_id)
    
    if ward_id:
        w_str = str(ward_id).strip().upper()
        wards = get_all_coimbatore_wards()
        matched = [w for w in wards if w["ward_id"].upper() == w_str or f"WARD_{w['ward_number']:03d}" == w_str or str(w["ward_number"]) == w_str]
        if matched:
            w = matched[0]
            telemetry["mapped_ward"] = {
                "ward_id": w["ward_id"],
                "ward_number": w["ward_number"],
                "ward_name": w["ward_name"],
                "zone_name": w["zone_name"],
                "centroid_lat": w["centroid_lat"],
                "centroid_lon": w["centroid_lon"],
                "elevation_mean_m": w["elevation_mean_m"],
                "hand_mean_m": w["hand_mean_m"],
                "twi_mean": w["twi_mean"],
                "drainage_distance_m": w["drainage_distance_m"],
                "baseline_drainage_capacity_mmhr": w["baseline_drainage_capacity_mmhr"],
                "population": w["population"],
                "area_sqkm": w["area_sqkm"]
            }
            telemetry["station_name"] = f"Ward {w['ward_number']}: {w['ward_name']} ({w['zone_name']} Zone)"
            telemetry["latitude"] = w["centroid_lat"]
            telemetry["longitude"] = w["centroid_lon"]
            telemetry["elevation_m"] = w["elevation_mean_m"]
            
    return telemetry
