"""
Alerts REST API Router.
Handles alert retrieval, CAP 1.2 feeds, duty-officer approval, and SMS delivery tracking.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.app.database import get_db
from backend.app.models.schema import AlertModel, AlertDeliveryModel, GeofenceModel
from backend.app.services.alert_engine import AlertEngineService
from backend.app.services.cap_builder import CAPBuilder

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])

class ApprovalRequest(BaseModel):
    officer_name: str
    notes: Optional[str] = "Duty officer emergency authorization verified."

@router.get("")
def get_alerts(
    ward_id: Optional[str] = None,
    tier: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db)
):
    """Retrieves recent alerts with optional filtering."""
    query = db.query(AlertModel)
    if ward_id:
        query = query.filter(AlertModel.ward_id == ward_id)
    if tier:
        query = query.filter(AlertModel.tier == tier.lower())
    if status:
        query = query.filter(AlertModel.status == status)
    
    alerts = query.order_by(AlertModel.issued_at.desc()).limit(limit).all()
    
    return [
        {
            "alert_id": a.alert_id,
            "cap_identifier": a.cap_identifier,
            "ward_id": a.ward_id,
            "tier": a.tier,
            "headline_en": a.headline_en,
            "headline_ta": a.headline_ta,
            "description_en": a.description_en,
            "description_ta": a.description_ta,
            "calibrated_prob": a.calibrated_prob,
            "status": a.status,
            "approved_by": a.approved_by,
            "approval_timestamp": a.approval_timestamp.isoformat() if a.approval_timestamp else None,
            "issued_at": a.issued_at.isoformat(),
            "expires_at": a.expires_at.isoformat()
        }
        for a in alerts
    ]

@router.get("/{alert_id}/cap")
def get_alert_cap(alert_id: str, db: Session = Depends(get_db)):
    """Generates standard OASIS CAP v1.2 JSON for the specified alert."""
    alert = db.query(AlertModel).filter(AlertModel.alert_id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    geofence = db.query(GeofenceModel).filter(GeofenceModel.ward_id == alert.ward_id).first()
    polygon = geofence.polygon_geojson if geofence else {}
    ward_num = geofence.ward_number if geofence else 0
    ward_name = geofence.ward_name if geofence else alert.ward_id

    return CAPBuilder.build_cap_json(
        alert_id=alert.alert_id,
        ward_id=alert.ward_id,
        ward_number=ward_num,
        ward_name=ward_name,
        tier=alert.tier,
        probability=alert.calibrated_prob,
        headline_en=alert.headline_en,
        description_en=alert.description_en,
        headline_ta=alert.headline_ta,
        description_ta=alert.description_ta,
        expires_at=alert.expires_at,
        area_polygon=polygon
    )

@router.post("/{alert_id}/approve")
def approve_alert(alert_id: str, req: ApprovalRequest, db: Session = Depends(get_db)):
    """Human-in-the-loop duty officer authorization for pending Red alerts."""
    try:
        res = AlertEngineService.approve_and_dispatch_alert(
            db=db,
            alert_id=alert_id,
            officer_name=req.officer_name,
            notes=req.notes
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/deliveries/recent")
def get_recent_deliveries(limit: int = 50, db: Session = Depends(get_db)):
    """Retrieves SMS dispatch delivery receipts."""
    deliveries = db.query(AlertDeliveryModel).order_by(AlertDeliveryModel.dispatched_at.desc()).limit(limit).all()
    return [
        {
            "delivery_id": d.delivery_id,
            "alert_id": d.alert_id,
            "channel": d.channel,
            "phone_or_token": d.phone_or_token,
            "payload_text": d.payload_text,
            "dispatch_status": d.dispatch_status,
            "gateway_message_id": d.gateway_message_id,
            "dispatched_at": d.dispatched_at.isoformat()
        }
        for d in deliveries
    ]

class TestSmsRequest(BaseModel):
    phone_number: str
    tier: Optional[str] = "red"
    ward_number: Optional[int] = 53
    ward_name: Optional[str] = "Railway Station Zone"
    language: Optional[str] = "en"
    gateway_provider: Optional[str] = "simulator"

@router.post("/test-sms")
def send_test_sms(req: TestSmsRequest, db: Session = Depends(get_db)):
    """Dispatches a direct real-time SMS to the provided phone number via telecom carrier simulator."""
    from backend.app.services.sms_service import SMSService
    return SMSService.dispatch_direct_test_sms(
        db=db,
        phone_number=req.phone_number,
        tier=req.tier,
        ward_number=req.ward_number,
        ward_name=req.ward_name,
        language=req.language,
        gateway_provider=req.gateway_provider
    )

@router.post("/clear-sms-deliveries")
@router.delete("/deliveries")
def clear_sms_deliveries(db: Session = Depends(get_db)):
    """Deletes all sent SMS delivery records from the database."""
    deleted_count = db.query(AlertDeliveryModel).delete()
    db.commit()
    return {
        "status": "success",
        "deleted_count": deleted_count,
        "message": f"Successfully cleared {deleted_count} sent SMS delivery logs."
    }

@router.post("/clear-simulation-alerts")
def clear_simulation_alerts(db: Session = Depends(get_db)):
    """Clears past alerts to synchronize alert queue with current live weather."""
    from backend.app.services.alert_engine import WARD_STATE_TRACKER
    WARD_STATE_TRACKER.clear()
    db.query(AlertDeliveryModel).delete()
    db.query(AlertModel).delete()
    db.commit()
    return {"status": "cleared", "message": "Alert queue and tracker synchronized with live baseline."}


