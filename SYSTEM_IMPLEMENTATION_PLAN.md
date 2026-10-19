# AI-Based Localized Flood Risk, Inundation Mapping and Early Warning System
## Comprehensive System Implementation Plan & Technical Architecture

### 1. Executive Summary & Core Objectives
This document defines the production engineering specification for an end-to-end AI-based flood risk, inundation mapping, and automated early warning system. Designed as a real-time operational platform for Coimbatore and surrounding districts in Tamil Nadu/Kerala, the system decouples into two specialized paths:
1. **Operational Path (Predictive Hazard & Real-Time Alerting):** Ingests real-time weather forecasts and near-real-time observations via live APIs (Open-Meteo / IMERG), computes antecedent precipitation and terrain indices (HAND, TWI, drainage proximity), predicts ward-level flood probabilities using an Isotonically calibrated XGBoost classifier, and issues bilingual (Tamil & English) Common Alerting Protocol (CAP v1.2) alerts and targeted SMS messages to citizens in affected wards.
2. **Analysis Path (Post-Event Observational Validation & Exposure):** Ingests Sentinel-1 Synthetic Aperture Radar (SAR) imagery via cloud APIs (Earth Engine / Planetary Computer STAC), segments surface water inundation using a deep-learning U-Net, calculates actual flooded footprint, overlays building and road infrastructure exposure, and validates operational predictions.

---

### 2. Technology Stack
- **Backend & ML Services:** Python 3.13 (running within dedicated `.venv`)
  - **Framework:** FastAPI with Uvicorn (REST API, OpenAPI/Swagger docs)
  - **Machine Learning:** XGBoost (primary operational classifier), Scikit-Learn (Isotonic calibration, Random Forest baseline), SHAP (offline explainability)
  - **Deep Learning & Spatial:** PyTorch (U-Net SAR segmentation), NumPy, Pandas, Scipy, Shapely
  - **Task Scheduling:** APScheduler (periodic ingestion every 3 hours)
- **Database:** MySQL 8.0+ / MariaDB (managed via SQLAlchemy ORM and PyMySQL, with spatial/GeoJSON polygon storage for ward geofencing)
- **Frontend / Web Dashboard:** Modern React (JavaScript / Vite)
  - **Styling:** Premium Vanilla CSS design system (Dark mode, glassmorphism, responsive)
  - **Mapping:** Leaflet.js / React-Leaflet with custom GeoJSON ward layers and raster overlays
  - **Charts:** Chart.js / Recharts for probability distributions, calibration curves, and feature importances
- **Messaging & Alerting:**
  - **SMS Gateway Adapter:** Pluggable service supporting simulated telecommunication broadcast and live aggregator REST APIs (CDAC, Gupshup, Twilio) with TRAI DLT header compliance.
  - **Alert Feed:** OASIS CAP v1.2 XML / JSON feed for emergency management ingestion.

---

### 3. Data Strategy: Real-Time APIs & Authentic Historical Datasets

#### 3.1 Real-Time Data Ingestion (Operational Path)
- **Meteorological Forecasts & Telemetry:** Integrated via **Open-Meteo Historical & Forecast API** (free, open data, high-resolution ECMWF/GFS-based hourly precipitation, 2m temperature, relative humidity, wind speed, and soil moisture).
- **Antecedent Precipitation Index (API):** Computed recursively from rolling 7-day and 14-day precipitation series using decay factor $\alpha \approx 0.85$:
  $$\text{API}_t = \sum_{i=1}^{N} \alpha^i \cdot P_{t-i}$$
- **Terrain & Hydrology:** Copernicus GLO-30 DEM (30m resolution) clipped to Coimbatore Corporation (100 wards). Derived features per ward polygon:
  - Mean elevation and slope
  - **HAND (Height Above Nearest Drainage)**: Relative vertical elevation above natural stream channels
  - **TWI (Topographic Wetness Index)**: $\ln(a / \tan \beta)$
  - Distance to primary drainage corridors (Noyyal River, Sanganoor Pallam, Valankulam, Singanallur lakes).

#### 3.2 Authentic Historical Datasets & Labels (No Synthetic Data)
- **Ground Truth Flood Labels:** Compiled from authentic historical records:
  - Coimbatore City Municipal Corporation (CCMC) monsoon waterlogging registers and disaster helpline complaint logs (2018–2024).
  - Tamil Nadu State Disaster Management Authority (TNSDMA) flood impact bulletins.
  - Dartmouth Flood Observatory (DFO) and EM-DAT international disaster database event dates for Tamil Nadu and Kerala basins (e.g. August 2018, October–November 2021, December 2023).
  - Dartmouth / Bhuvan observed inundation events.
- **Meteorological Training Series:** Real IMD (India Meteorological Department) gridded rainfall archive (0.25° resolution) cross-calibrated with ERA5-Land reanalysis.
- **Satellite Benchmark Data:** Sen1Floods11 georeferenced Sentinel-1 SAR flood event dataset for U-Net pretraining, fine-tuned on South Indian monsoonal events.

---

### 4. MySQL Database Schema Design

```sql
-- Coimbatore Wards and Spatial Geofences
CREATE TABLE geofences (
    ward_id VARCHAR(32) PRIMARY KEY,
    ward_number INT NOT NULL,
    ward_name VARCHAR(128) NOT NULL,
    zone_name VARCHAR(64) NOT NULL,
    area_sqkm FLOAT NOT NULL,
    centroid_lat FLOAT NOT NULL,
    centroid_lon FLOAT NOT NULL,
    polygon_geojson JSON NOT NULL,
    baseline_drainage_capacity FLOAT DEFAULT 50.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Citizen & Institutional Opt-In Subscriptions
CREATE TABLE subscriptions (
    subscription_id VARCHAR(64) PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    ward_id VARCHAR(32) NOT NULL,
    language_pref ENUM('en', 'ta') DEFAULT 'en',
    alert_min_tier ENUM('yellow', 'orange', 'red') DEFAULT 'yellow',
    is_active BOOLEAN DEFAULT TRUE,
    opt_in_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ward_id) REFERENCES geofences(ward_id)
);

-- Model Ingestion & Prediction Execution Logs
CREATE TABLE model_runs (
    run_id VARCHAR(64) PRIMARY KEY,
    run_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lead_time_hours INT DEFAULT 24,
    forecast_source VARCHAR(64) NOT NULL,
    mean_forecast_rain_mm FLOAT NOT NULL,
    max_ward_probability FLOAT NOT NULL,
    high_risk_wards_count INT NOT NULL,
    model_version VARCHAR(32) NOT NULL
);

-- Ward-Level Predictions per Run
CREATE TABLE ward_predictions (
    prediction_id VARCHAR(64) PRIMARY KEY,
    run_id VARCHAR(64) NOT NULL,
    ward_id VARCHAR(32) NOT NULL,
    raw_probability FLOAT NOT NULL,
    calibrated_probability FLOAT NOT NULL,
    risk_tier ENUM('green', 'yellow', 'orange', 'red') NOT NULL,
    rain_24h_forecast FLOAT NOT NULL,
    api_7d FLOAT NOT NULL,
    hand_mean FLOAT NOT NULL,
    twi_mean FLOAT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES model_runs(run_id),
    FOREIGN KEY (ward_id) REFERENCES geofences(ward_id)
);

-- Alert Records & CAP 1.2 Lifecycle
CREATE TABLE alerts (
    alert_id VARCHAR(64) PRIMARY KEY,
    cap_identifier VARCHAR(128) UNIQUE NOT NULL,
    ward_id VARCHAR(32) NOT NULL,
    tier ENUM('yellow', 'orange', 'red') NOT NULL,
    headline_en VARCHAR(255) NOT NULL,
    headline_ta VARCHAR(255) NOT NULL,
    description_en TEXT NOT NULL,
    description_ta TEXT NOT NULL,
    calibrated_prob FLOAT NOT NULL,
    status ENUM('pending_approval', 'dispatched', 'cancelled', 'resolved') NOT NULL,
    approved_by VARCHAR(64) NULL,
    approval_timestamp TIMESTAMP NULL,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (ward_id) REFERENCES geofences(ward_id)
);

-- Multi-Channel SMS & Push Deliveries
CREATE TABLE alert_deliveries (
    delivery_id VARCHAR(64) PRIMARY KEY,
    alert_id VARCHAR(64) NOT NULL,
    subscription_id VARCHAR(64) NOT NULL,
    channel ENUM('sms', 'push', 'telegram') NOT NULL,
    phone_or_token VARCHAR(128) NOT NULL,
    payload_text TEXT NOT NULL,
    dispatch_status ENUM('sent', 'failed', 'delivered') NOT NULL,
    gateway_message_id VARCHAR(128) NULL,
    dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_id) REFERENCES alerts(alert_id),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(subscription_id)
);

-- Immutable Security & Operational Audit Log
CREATE TABLE audit_logs (
    log_id VARCHAR(64) PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    performed_by VARCHAR(64) NOT NULL,
    ward_id VARCHAR(32) NULL,
    details JSON NOT NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 5. Alert Engine & Targeted SMS Notification System

#### 5.1 IMD-Aligned Tier Thresholds
- **Green (Normal):** $P < 0.30$ (No broadcast; routine monitoring)
- **Yellow (Watch):** $0.30 \le P < 0.60$ (Advisory sent to dashboard and opt-in agencies)
- **Orange (Warning):** $0.60 \le P < 0.80$ (Targeted citizen SMS and push notifications)
- **Red (Alert):** $P \ge 0.80$ (Urgent alert; requires Human-in-the-Loop officer approval before mass broadcast)

#### 5.2 Hysteresis, Cooldown & All-Clear Rules
- **Escalation:** Risk immediately escalates when $P$ crosses a tier threshold.
- **De-escalation Hysteresis:** A ward drops tier only if $P$ remains below the threshold minus a $0.05$ margin across two consecutive inference cycles (prevents alert flickering).
- **Cooldown:** Minimum 6 hours between repetitive broadcasts for the same ward unless the tier escalates to Red.
- **All-Clear Notification:** Dispatched when a ward under Orange/Red status drops safely back to Green for $>6$ hours.

#### 5.3 Bilingual SMS Notification Architecture
SMS messages are concisely structured (under 160 characters in GSM-7 or Unicode for Tamil) to ensure delivery without truncation:
- **English Example (Orange Warning):**
  `[FLOOD WARNING] Ward 42 (Peelamedu): High flood risk in next 24h. Avoid low-lying underpasses. Emergency helpline: 1077. Official: TNSDMA`
- **Tamil Example (Orange Warning):**
  `[வெள்ள எச்சரிக்கை] வார்டு 42 (பீளமேடு): அடுத்த 24 மணி நேரத்தில் வெள்ள அபாயம். சுரங்கப்பாதைகளை தவிர்க்கவும். உதவி எண்: 1077.`

---

### 6. Post-Event Analysis Path (Sentinel-1 & U-Net)
1. **SAR Ingestion:** Queries Sentinel-1 IW GRD (Interferometric Wide Swath Ground Range Detected) backscatter data covering Coimbatore and the Noyyal basin.
2. **Preprocessing:** Thermal noise removal, radiometric calibration to $\sigma^0$, Lee speckle filtering, and calculation of composite dual-pol channel ($VV, VH, VV/VH$).
3. **U-Net Deep Learning Segmentation:** Pretrained PyTorch U-Net model segments water pixels from background landcover.
4. **Exposure Overlay:** Vectorized flood polygons intersect with OpenStreetMap building footprints and road centerlines to calculate:
   - Flooded area ($km^2$)
   - Number of exposed residential and commercial buildings
   - Inundated road segments and transport disruption score.
5. **Operational Verification:** Computes confusion matrix (True Positives, False Alarms, Misses) against the pre-event XGBoost 24-hour prediction.

---

### 7. Implementation Execution Phases
- **Phase 1: Environment & Spatial Infrastructure**
  - Initialize `.venv`, install all dependencies (`fastapi`, `xgboost`, `scikit-learn`, `torch`, `sqlalchemy`, `pymysql`, `apscheduler`, etc.).
  - Build GeoJSON boundary models for Coimbatore Corporation's wards with computed terrain descriptors (HAND, TWI, elevation).
- **Phase 2: Data Pipeline & Operational ML Models**
  - Open-Meteo live API client and API calculator.
  - Authentic historical training set compiled from real meteorological and disaster logs.
  - XGBoost training, Isotonic probability calibration, Random Forest baseline, and Rainfall-threshold heuristic.
- **Phase 3: Alert Engine, CAP 1.2 & Bilingual SMS Gateway**
  - Implement alert engine with hysteresis, cooldown, and human approval workflow.
  - Implement pluggable SMS service (simulator + live API), bilingual templates, and CAP 1.2 XML/JSON builder.
- **Phase 4: Post-Event Analysis Path**
  - PyTorch U-Net flood segmentation model and OSM infrastructure exposure module.
- **Phase 5: FastAPI Backend & Scheduled Orchestrator**
  - Database migrations, REST API endpoints, and APScheduler background tasks.
- **Phase 6: Modern Interactive React Dashboard**
  - Leaflet-based live hazard map, real-time weather simulation slider, officer approval console, SMS broadcast logs, and citizen opt-in portal.
- **Phase 7: System Verification & Validation**
  - End-to-end execution of a simulated monsoon deluge across Coimbatore verifying the complete pipeline from prediction to SMS delivery and post-event analysis.
