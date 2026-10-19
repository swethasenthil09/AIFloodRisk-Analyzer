"""
Real-Time Tiered Alert Engine with Hysteresis, Cooldown, and Human Approval.
Maintains operational state across inference cycles, triggers targeted bilingual SMS,
and records comprehensive audit logs.
"""

import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.models.schema import (
    AlertModel, GeofenceModel, ModelRunModel, WardPredictionModel, AuditLogModel, SubscriptionModel
)
from backend.app.services.sms_service import SMSService
from backend.app.services.cap_builder import CAPBuilder

# In-memory operational tracker for hysteresis and cooldown across cycles
# ward_id -> {"current_tier": str, "last_alert_time": datetime, "deescalation_count": int}
WARD_STATE_TRACKER: Dict[str, Dict[str, Any]] = {}

class AlertEngineService:
    """Manages the full lifecycle of flood alerts."""

    @classmethod
    def process_predictions_and_update_alerts(
        cls,
        db: Session,
        inference_result: Dict[str, Any],
        operator_user: str = "System_Scheduler"
    ) -> List[Dict[str, Any]]:
        """
        Evaluates new ward predictions, applies hysteresis and cooldown,
        creates Alert records, and dispatches SMS notifications.
        """
        all_wards = inference_result.get("all_wards", [])
        now = datetime.utcnow()
        generated_alerts = []

        # Record Model Run in database
        run_id = f"RUN_{uuid.uuid4().hex[:10].upper()}"
        model_run = ModelRunModel(
            run_id=run_id,
            run_timestamp=now,
            lead_time_hours=24,
            forecast_source=inference_result.get("telemetry", {}).get("source", "Open-Meteo Live API"),
            mean_forecast_rain_mm=inference_result.get("applied_rain_24h_mm", 0.0),
            max_ward_probability=inference_result.get("max_probability", 0.0),
            high_risk_wards_count=inference_result.get("tier_distribution", {}).get("orange", 0) + inference_result.get("tier_distribution", {}).get("red", 0),
            model_version="XGBoost_Isotonic_v1.0"
        )
        db.add(model_run)

        # Process each ward
        for w in all_wards:
            ward_id = w["ward_id"]
            ward_num = w["ward_number"]
            ward_name = w["ward_name"]
            prob = w["calibrated_probability"]
            predicted_tier = w["risk_tier"]

            # Store per-ward prediction record
            pred_record = WardPredictionModel(
                prediction_id=f"PRED_{uuid.uuid4().hex[:12].upper()}",
                run_id=run_id,
                ward_id=ward_id,
                raw_probability=prob,
                calibrated_probability=prob,
                risk_tier=predicted_tier,
                rain_24h_forecast=w["rain_24h_mm"],
                api_7d=w["api_7d_mm"],
                hand_mean=w["hand_m"],
                twi_mean=w["twi"]
            )
            db.add(pred_record)

            # Retrieve state tracker
            state = WARD_STATE_TRACKER.get(ward_id, {
                "active_tier": "green",
                "last_alert_time": None,
                "deescalation_count": 0
            })

            active_tier = state["active_tier"]

            # --- Hysteresis Logic ---
            tier_ranks = {"green": 0, "yellow": 1, "orange": 2, "red": 3}
            new_rank = tier_ranks[predicted_tier]
            cur_rank = tier_ranks[active_tier]

            target_tier = active_tier
            if new_rank > cur_rank:
                # Immediate escalation
                target_tier = predicted_tier
                state["deescalation_count"] = 0
            elif new_rank < cur_rank:
                # De-escalation hysteresis check (requires margin below threshold)
                margin = settings.DEESCALATION_MARGIN
                threshold = settings.TIER_GREEN_MAX if cur_rank == 1 else (settings.TIER_YELLOW_MAX if cur_rank == 2 else settings.TIER_ORANGE_MAX)
                if prob < (threshold - margin):
                    state["deescalation_count"] += 1
                    if state["deescalation_count"] >= settings.DEESCALATION_CYCLES_REQUIRED:
                        target_tier = predicted_tier
                        state["deescalation_count"] = 0
            else:
                state["deescalation_count"] = 0

            # --- Cooldown & Action Trigger ---
            should_issue_alert = False
            last_alert_time = state.get("last_alert_time")
            is_escalating_to_red = (target_tier == "red" and active_tier != "red")

            if target_tier in ["yellow", "orange", "red"]:
                if target_tier != active_tier:
                    should_issue_alert = True
                elif last_alert_time is None or (now - last_alert_time) > timedelta(hours=settings.COOLDOWN_HOURS):
                    should_issue_alert = True
                elif is_escalating_to_red:
                    should_issue_alert = True
            elif active_tier in ["orange", "red"] and target_tier == "green":
                # Trigger All-Clear Alert
                should_issue_alert = True

            if should_issue_alert:
                alert_id = f"ALT_{uuid.uuid4().hex[:10].upper()}"
                cap_id = f"CAP_{uuid.uuid4().hex[:12].upper()}"
                is_all_clear = (target_tier == "green")
                
                # Bilingual text formulation
                if is_all_clear:
                    alert_tier = "green"
                    h_en = f"All Clear: Flood Risk Receded for Ward {ward_num} ({ward_name})"
                    h_ta = f"அபாயம் நீங்கியது: வார்டு {ward_num} ({ward_name}) வெள்ள அபாயம் குறைந்தது"
                    d_en = f"Flood probability has subsided safely to {prob*100:.1f}%. Storm drainage is functioning normally."
                    d_ta = f"வெள்ள அபாயம் {prob*100:.1f}% ஆக குறைந்துள்ளது. வடிகால் சீராக இயங்குகிறது."
                    # Mark any previous alerts for this ward as resolved
                    db.query(AlertModel).filter(
                        AlertModel.ward_id == ward_id,
                        AlertModel.status.in_(["pending_approval", "dispatched"])
                    ).update({"status": "resolved"}, synchronize_session=False)
                else:
                    alert_tier = target_tier
                    h_en = f"{target_tier.upper()} Flood Advisory for Ward {ward_num} ({ward_name})"
                    h_ta = f"{target_tier.upper()} வெள்ள எச்சரிக்கை - வார்டு {ward_num} ({ward_name})"
                    d_en = f"Calibrated 24h flood probability is {prob*100:.1f}% due to {w['rain_24h_mm']}mm forecast precipitation. Terrain HAND: {w['hand_m']}m."
                    d_ta = f"அடுத்த 24 மணி நேரத்தில் {prob*100:.1f}% வெள்ள அபாயம் உள்ளது. மழை அளவு: {w['rain_24h_mm']}மி.மீ."
                    # Resolve older superseded alerts for this ward
                    db.query(AlertModel).filter(
                        AlertModel.ward_id == ward_id,
                        AlertModel.status == "dispatched"
                    ).update({"status": "resolved"}, synchronize_session=False)

                # Status and Human Approval Policy:
                # RED alerts require human approval by default before mass broadcast
                initial_status = "pending_approval" if target_tier == "red" else ("resolved" if is_all_clear else "dispatched")
                approved_by = None if target_tier == "red" else "Auto_Rule_Engine"
                app_time = None if target_tier == "red" else now

                alert = AlertModel(
                    alert_id=alert_id,
                    cap_identifier=cap_id,
                    ward_id=ward_id,
                    tier=alert_tier,
                    headline_en=h_en,
                    headline_ta=h_ta,
                    description_en=d_en,
                    description_ta=d_ta,
                    calibrated_prob=prob,
                    status=initial_status,
                    approved_by=approved_by,
                    approval_timestamp=app_time,
                    issued_at=now,
                    expires_at=now + timedelta(hours=24)
                )
                db.add(alert)
                db.flush()

                # Dispatch SMS if not held for human approval
                sms_receipts = []
                if initial_status == "dispatched":
                    sms_receipts = SMSService.dispatch_ward_sms(
                        db=db,
                        alert=alert,
                        target_ward_id=ward_id,
                        ward_number=ward_num,
                        ward_name=ward_name,
                        probability=prob
                    )

                state["active_tier"] = target_tier
                state["last_alert_time"] = now

                generated_alerts.append({
                    "alert_id": alert_id,
                    "cap_identifier": cap_id,
                    "ward_id": ward_id,
                    "ward_number": ward_num,
                    "ward_name": ward_name,
                    "tier": alert_tier,
                    "probability": prob,
                    "status": initial_status,
                    "requires_approval": initial_status == "pending_approval",
                    "sms_dispatched_count": len(sms_receipts),
                    "headline_en": h_en,
                    "headline_ta": h_ta
                })

            WARD_STATE_TRACKER[ward_id] = state

        db.commit()
        return generated_alerts

    @classmethod
    def approve_and_dispatch_alert(
        cls,
        db: Session,
        alert_id: str,
        officer_name: str,
        notes: str = ""
    ) -> Dict[str, Any]:
        """
        Duty-officer approval action for pending Red alerts.
        Executes immediate targeted SMS broadcast and records immutable audit log.
        """
        alert = db.query(AlertModel).filter(AlertModel.alert_id == alert_id).first()
        if not alert:
            raise ValueError(f"Alert {alert_id} not found.")

        if alert.status == "dispatched":
            return {"message": "Alert was already approved and dispatched.", "alert_id": alert_id}

        now = datetime.utcnow()
        alert.status = "dispatched"
        alert.approved_by = officer_name
        alert.approval_timestamp = now

        # Fetch ward details
        geofence = db.query(GeofenceModel).filter(GeofenceModel.ward_id == alert.ward_id).first()
        ward_num = geofence.ward_number if geofence else 0
        ward_name = geofence.ward_name if geofence else alert.ward_id

        # Dispatch Targeted SMS to residents
        sms_deliveries = SMSService.dispatch_ward_sms(
            db=db,
            alert=alert,
            target_ward_id=alert.ward_id,
            ward_number=ward_num,
            ward_name=ward_name,
            probability=alert.calibrated_prob
        )

        # Audit Log
        audit = AuditLogModel(
            log_id=f"AUD_{uuid.uuid4().hex[:10].upper()}",
            event_type="OFFICER_RED_ALERT_APPROVAL",
            performed_by=officer_name,
            ward_id=alert.ward_id,
            details={
                "alert_id": alert_id,
                "tier": alert.tier,
                "probability": alert.calibrated_prob,
                "notes": notes,
                "sms_dispatched": len(sms_deliveries)
            },
            created_at=now
        )
        db.add(audit)
        db.commit()

        return {
            "status": "success",
            "alert_id": alert_id,
            "approved_by": officer_name,
            "dispatched_at": now.isoformat(),
            "sms_delivered_count": len(sms_deliveries),
            "sms_sample": sms_deliveries[0] if sms_deliveries else None
        }
