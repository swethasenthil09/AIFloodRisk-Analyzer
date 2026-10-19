"""
Main FastAPI Application Entrypoint.
Initializes REST APIs, database schemas, geofences seed, CORS, and scheduler.
"""

import sys
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure workspace root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.app.config import settings
from backend.app.database import engine, Base, SessionLocal
from backend.app.models.schema import GeofenceModel, SubscriptionModel
from backend.app.data.coimbatore_wards import get_all_coimbatore_wards
from backend.app.services.scheduler import start_scheduler, shutdown_scheduler

# Import Routers
from backend.app.routers.alerts import router as alerts_router
from backend.app.routers.inference import router as inference_router
from backend.app.routers.subscriptions import router as subscriptions_router
from backend.app.routers.sar import router as sar_router
from backend.app.routers.weather import router as weather_router
from backend.app.routers.analyzer import router as analyzer_router

def init_database_data():
    """Initializes tables and seeds 100 Coimbatore wards and initial demo subscriptions."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Check if geofences already populated
        count = db.query(GeofenceModel).count()
        if count == 0:
            print("Populating 100 Coimbatore Municipal Wards in database...")
            wards_data = get_all_coimbatore_wards()
            for w in wards_data:
                g = GeofenceModel(
                    ward_id=w["ward_id"],
                    ward_number=w["ward_number"],
                    ward_name=w["ward_name"],
                    zone_name=w["zone_name"],
                    area_sqkm=w["area_sqkm"],
                    population=w["population"],
                    centroid_lat=w["centroid_lat"],
                    centroid_lon=w["centroid_lon"],
                    elevation_mean_m=w["elevation_mean_m"],
                    hand_mean_m=w["hand_mean_m"],
                    twi_mean=w["twi_mean"],
                    slope_mean_deg=w["slope_mean_deg"],
                    drainage_distance_m=w["drainage_distance_m"],
                    baseline_drainage_capacity_mmhr=w["baseline_drainage_capacity_mmhr"],
                    polygon_geojson=w["polygon_geojson"]
                )
                db.add(g)
            db.commit()
            print("Successfully populated 100 Wards.")

        # Seed initial sample citizen subscriptions for emergency demonstration
        sub_count = db.query(SubscriptionModel).count()
        if sub_count == 0:
            print("Seeding initial demonstration citizen subscriptions...")
            demo_subs = [
                ("SUB_PEELAMEDU_EN", "+919876543210", "WARD_010", "en", "orange"),
                ("SUB_PEELAMEDU_TA", "+919876543211", "WARD_010", "ta", "orange"),
                ("SUB_SINGANALLUR_EN", "+919876543212", "WARD_023", "en", "yellow"),
                ("SUB_SINGANALLUR_TA", "+919876543213", "WARD_023", "ta", "yellow"),
                ("SUB_UKKADAM_TA", "+919876543214", "WARD_057", "ta", "red"),
                ("SUB_RAMANATHAPURAM_EN", "+919876543215", "WARD_031", "en", "orange"),
                ("SUB_RATHINAPURI_TA", "+919876543216", "WARD_047", "ta", "orange"),
                ("SUB_GANAPATHY_EN", "+919876543217", "WARD_011", "en", "yellow"),
            ]
            for s_id, phone, w_id, lang, tier in demo_subs:
                s = SubscriptionModel(
                    subscription_id=s_id,
                    phone_number=phone,
                    ward_id=w_id,
                    language_pref=lang,
                    alert_min_tier=tier,
                    is_active=True
                )
                db.add(s)
            db.commit()
            print("Seeded 8 initial bilingual subscriptions.")
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("[Startup] Initializing Database & Geofencing...")
    init_database_data()
    print("[Startup] Launching Ingestion Scheduler...")
    start_scheduler()
    yield
    # Shutdown
    print("[Shutdown] Stopping Scheduler...")
    shutdown_scheduler()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Operational Flood Risk Prediction, SAR Inundation Mapping & Bilingual SMS Early Warning Engine.",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(inference_router)
app.include_router(alerts_router)
app.include_router(subscriptions_router)
app.include_router(sar_router)
app.include_router(weather_router)
app.include_router(analyzer_router)

@app.get("/")
def root():
    return {
        "system": settings.APP_NAME,
        "version": settings.VERSION,
        "study_area": settings.STUDY_AREA_NAME,
        "status": "operational",
        "endpoints": {
            "docs": "/docs",
            "live_inference": "/api/inference/latest",
            "storm_simulation": "/api/inference/simulate",
            "metrics": "/api/inference/metrics",
            "wards_geojson": "/api/inference/wards-geojson",
            "alerts": "/api/alerts",
            "subscriptions": "/api/subscriptions",
            "sar_analysis": "/api/sar/latest",
            "live_weather": "/api/weather/live"
        }
    }
