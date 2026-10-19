"""
Automated Periodic Data Ingestion & Inference Scheduler.
Runs background jobs via APScheduler to ingest Open-Meteo forecasts
and update ward flood probabilities every 3 hours.
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from backend.app.database import SessionLocal
from backend.app.services.weather_service import WeatherInferenceService
from backend.app.services.alert_engine import AlertEngineService

scheduler = BackgroundScheduler()
weather_service = WeatherInferenceService()

def scheduled_weather_and_inference_job():
    """Runs automated weather fetch and ward risk updates."""
    print("[Scheduler] Executing scheduled flood risk assessment...")
    db = SessionLocal()
    try:
        results = weather_service.predict_ward_risks()
        new_alerts = AlertEngineService.process_predictions_and_update_alerts(
            db=db,
            inference_result=results,
            operator_user="Automated_3h_Scheduler"
        )
        print(f"[Scheduler] Completed cycle: {len(new_alerts)} new alerts evaluated.")
    except Exception as e:
        print(f"[Scheduler] Error during execution: {e}")
    finally:
        db.close()

def start_scheduler():
    """Starts the background scheduler."""
    if not scheduler.running:
        scheduler.add_job(
            scheduled_weather_and_inference_job,
            trigger=IntervalTrigger(hours=3),
            id="periodic_flood_assessment",
            name="Periodic Open-Meteo Ingestion & Risk Inference",
            replace_existing=True
        )
        scheduler.start()
        print("[Scheduler] APScheduler background service started successfully.")

def shutdown_scheduler():
    """Shuts down the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown()
        print("[Scheduler] APScheduler stopped.")
