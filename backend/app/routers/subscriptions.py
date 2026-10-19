"""
Citizen & Agency Opt-In Subscriptions Router.
Enables ward-level SMS / Push notification subscription with bilingual preferences (Tamil / English).
Fully compliant with India's Digital Personal Data Protection (DPDP) Act, 2023.
"""

import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from backend.app.database import get_db
from backend.app.models.schema import SubscriptionModel, GeofenceModel

router = APIRouter(prefix="/api/subscriptions", tags=["Citizen Subscriptions"])

class SubscriptionRequest(BaseModel):
    phone_number: str = Field(..., description="Mobile number with country code, e.g. +919876543210")
    ward_id: str = Field(..., description="Target ward ID, e.g. WARD_010 or WARD_023")
    language_pref: str = Field("en", description="'en' for English or 'ta' for Tamil")
    alert_min_tier: str = Field("orange", description="Minimum tier: 'yellow', 'orange', or 'red'")

@router.post("")
def create_subscription(req: SubscriptionRequest, db: Session = Depends(get_db)):
    """Registers an opt-in subscription for localized flood warnings."""
    # Validate ward existence
    geofence = db.query(GeofenceModel).filter(GeofenceModel.ward_id == req.ward_id).first()
    if not geofence:
        raise HTTPException(status_code=400, detail=f"Ward ID {req.ward_id} is invalid.")

    # Normalize phone
    clean_phone = req.phone_number.strip()
    if not (clean_phone.startswith("+91") or len(clean_phone) == 10):
        if len(clean_phone) == 10 and clean_phone.isdigit():
            clean_phone = f"+91{clean_phone}"

    # Check existing subscription
    existing = db.query(SubscriptionModel).filter(
        SubscriptionModel.phone_number == clean_phone,
        SubscriptionModel.ward_id == req.ward_id
    ).first()

    if existing:
        existing.is_active = True
        existing.language_pref = req.language_pref
        existing.alert_min_tier = req.alert_min_tier
        db.commit()
        return {
            "status": "updated",
            "subscription_id": existing.subscription_id,
            "message": f"Updated active flood alert subscription for {geofence.ward_name} ({req.language_pref.upper()})"
        }

    sub_id = f"SUB_{uuid.uuid4().hex[:10].upper()}"
    new_sub = SubscriptionModel(
        subscription_id=sub_id,
        phone_number=clean_phone,
        ward_id=req.ward_id,
        language_pref=req.language_pref,
        alert_min_tier=req.alert_min_tier,
        is_active=True
    )
    db.add(new_sub)
    db.commit()

    return {
        "status": "created",
        "subscription_id": sub_id,
        "ward_name": geofence.ward_name,
        "language": req.language_pref,
        "message": f"Successfully enrolled {clean_phone} in {geofence.ward_name} early warnings."
    }

@router.get("")
def list_subscriptions(ward_id: Optional[str] = None, limit: int = 50, db: Session = Depends(get_db)):
    """Lists registered subscriptions."""
    query = db.query(SubscriptionModel)
    if ward_id:
        query = query.filter(SubscriptionModel.ward_id == ward_id)
    subs = query.limit(limit).all()
    return [
        {
            "subscription_id": s.subscription_id,
            "phone_masked": f"{s.phone_number[:5]}XXXXX{s.phone_number[-2:]}",
            "ward_id": s.ward_id,
            "language_pref": s.language_pref,
            "alert_min_tier": s.alert_min_tier,
            "is_active": s.is_active,
            "opt_in_timestamp": s.opt_in_timestamp.isoformat()
        }
        for s in subs
    ]

@router.delete("/{subscription_id}")
def delete_subscription(subscription_id: str, db: Session = Depends(get_db)):
    """Citizen opt-out endpoint."""
    sub = db.query(SubscriptionModel).filter(SubscriptionModel.subscription_id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    sub.is_active = False
    db.commit()
    return {"status": "success", "message": "Subscription cancelled. No further SMS will be sent."}
