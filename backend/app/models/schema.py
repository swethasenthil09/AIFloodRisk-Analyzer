"""
SQLAlchemy ORM Data Models for Flood Risk & Early Warning System.
Covers geofences, subscriptions, model runs, ward predictions, alerts, deliveries, and audit trails.
"""

import json
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from backend.app.database import Base

class GeofenceModel(Base):
    __tablename__ = "geofences"

    ward_id = Column(String(32), primary_key=True, index=True)
    ward_number = Column(Integer, nullable=False, index=True)
    ward_name = Column(String(128), nullable=False)
    zone_name = Column(String(64), nullable=False, index=True)
    area_sqkm = Column(Float, nullable=False)
    population = Column(Integer, default=15000)
    centroid_lat = Column(Float, nullable=False)
    centroid_lon = Column(Float, nullable=False)
    elevation_mean_m = Column(Float, default=415.0)
    hand_mean_m = Column(Float, default=4.5)
    twi_mean = Column(Float, default=11.5)
    slope_mean_deg = Column(Float, default=1.2)
    drainage_distance_m = Column(Float, default=300.0)
    baseline_drainage_capacity_mmhr = Column(Float, default=40.0)
    polygon_geojson = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    subscriptions = relationship("SubscriptionModel", back_populates="geofence")
    alerts = relationship("AlertModel", back_populates="geofence")

class SubscriptionModel(Base):
    __tablename__ = "subscriptions"

    subscription_id = Column(String(64), primary_key=True, index=True)
    phone_number = Column(String(20), nullable=False, index=True)
    ward_id = Column(String(32), ForeignKey("geofences.ward_id"), nullable=False, index=True)
    language_pref = Column(String(10), default="en") # "en" or "ta"
    alert_min_tier = Column(String(20), default="yellow") # "yellow", "orange", "red"
    is_active = Column(Boolean, default=True)
    opt_in_timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    geofence = relationship("GeofenceModel", back_populates="subscriptions")
    deliveries = relationship("AlertDeliveryModel", back_populates="subscription")

class ModelRunModel(Base):
    __tablename__ = "model_runs"

    run_id = Column(String(64), primary_key=True, index=True)
    run_timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    lead_time_hours = Column(Integer, default=24)
    forecast_source = Column(String(64), default="Open-Meteo ECMWF/GFS")
    mean_forecast_rain_mm = Column(Float, default=0.0)
    max_ward_probability = Column(Float, default=0.0)
    high_risk_wards_count = Column(Integer, default=0)
    model_version = Column(String(32), default="XGBoost_Isotonic_v1.0")

    # Relationships
    predictions = relationship("WardPredictionModel", back_populates="run", cascade="all, delete-orphan")

class WardPredictionModel(Base):
    __tablename__ = "ward_predictions"

    prediction_id = Column(String(64), primary_key=True, index=True)
    run_id = Column(String(64), ForeignKey("model_runs.run_id"), nullable=False, index=True)
    ward_id = Column(String(32), ForeignKey("geofences.ward_id"), nullable=False, index=True)
    raw_probability = Column(Float, nullable=False)
    calibrated_probability = Column(Float, nullable=False)
    risk_tier = Column(String(20), nullable=False, index=True) # "green", "yellow", "orange", "red"
    rain_24h_forecast = Column(Float, default=0.0)
    api_7d = Column(Float, default=0.0)
    hand_mean = Column(Float, default=0.0)
    twi_mean = Column(Float, default=0.0)

    # Relationships
    run = relationship("ModelRunModel", back_populates="predictions")

class AlertModel(Base):
    __tablename__ = "alerts"

    alert_id = Column(String(64), primary_key=True, index=True)
    cap_identifier = Column(String(128), unique=True, nullable=False, index=True)
    ward_id = Column(String(32), ForeignKey("geofences.ward_id"), nullable=False, index=True)
    tier = Column(String(20), nullable=False, index=True) # "yellow", "orange", "red"
    headline_en = Column(String(255), nullable=False)
    headline_ta = Column(String(255), nullable=False)
    description_en = Column(Text, nullable=False)
    description_ta = Column(Text, nullable=False)
    calibrated_prob = Column(Float, nullable=False)
    status = Column(String(32), default="pending_approval", index=True) # "pending_approval", "dispatched", "cancelled", "resolved"
    approved_by = Column(String(64), nullable=True)
    approval_timestamp = Column(DateTime, nullable=True)
    issued_at = Column(DateTime, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=False)

    # Relationships
    geofence = relationship("GeofenceModel", back_populates="alerts")
    deliveries = relationship("AlertDeliveryModel", back_populates="alert", cascade="all, delete-orphan")

class AlertDeliveryModel(Base):
    __tablename__ = "alert_deliveries"

    delivery_id = Column(String(64), primary_key=True, index=True)
    alert_id = Column(String(64), ForeignKey("alerts.alert_id"), nullable=False, index=True)
    subscription_id = Column(String(64), ForeignKey("subscriptions.subscription_id"), nullable=False, index=True)
    channel = Column(String(20), default="sms") # "sms", "push", "telegram"
    phone_or_token = Column(String(128), nullable=False)
    payload_text = Column(Text, nullable=False)
    dispatch_status = Column(String(32), default="sent") # "sent", "delivered", "failed"
    gateway_message_id = Column(String(128), nullable=True)
    dispatched_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    alert = relationship("AlertModel", back_populates="deliveries")
    subscription = relationship("SubscriptionModel", back_populates="deliveries")

class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    log_id = Column(String(64), primary_key=True, index=True)
    event_type = Column(String(64), nullable=False, index=True) # "ALERT_DISPATCH", "OFFICER_APPROVAL", "SIMULATION_RUN"
    performed_by = Column(String(64), nullable=False)
    ward_id = Column(String(32), nullable=True)
    details = Column(JSON, nullable=False)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
