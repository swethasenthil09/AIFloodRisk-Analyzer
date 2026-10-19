"""
System Configuration for Flood Risk, Inundation Mapping & Early Warning System.
Supports MySQL connection with seamless fallback to SQLite.
"""

import os
from pathlib import Path
from dataclasses import dataclass

try:
    from dotenv import load_dotenv
    # Resolve d:\ML-PROJECT\.env
    env_file = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_file.exists():
        load_dotenv(dotenv_path=env_file)
    else:
        load_dotenv()
except Exception:
    pass

@dataclass
class Settings:
    APP_NAME: str = "AI-Based Localized Flood Risk & Early Warning System"
    VERSION: str = "1.0.0"
    ENV: str = "development"
    
    # Study Area: Coimbatore City Municipal Corporation
    STUDY_AREA_NAME: str = "Coimbatore, Tamil Nadu"
    STUDY_AREA_LAT: float = 11.0168
    STUDY_AREA_LON: float = 76.9558
    
    # Database Configuration (MySQL / SQLite fallback)
    MYSQL_USER: str = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_HOST: str = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_PORT: str = os.getenv("MYSQL_PORT", "3306")
    MYSQL_DB: str = os.getenv("MYSQL_DB", "flood_risk_db")
    
    SQLITE_URL: str = "sqlite:///./flood_risk.db"
    USE_MYSQL: bool = os.getenv("USE_MYSQL", "false").lower() == "true"
    
    @property
    def DATABASE_URL(self) -> str:
        if self.USE_MYSQL and self.MYSQL_PASSWORD:
            import urllib.parse
            encoded_pwd = urllib.parse.quote_plus(self.MYSQL_PASSWORD)
            encoded_user = urllib.parse.quote_plus(self.MYSQL_USER)
            return f"mysql+pymysql://{encoded_user}:{encoded_pwd}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}"
        return self.SQLITE_URL

    # Alert Thresholds (IMD Aligned)
    TIER_GREEN_MAX: float = 0.30
    TIER_YELLOW_MAX: float = 0.60
    TIER_ORANGE_MAX: float = 0.80
    # Red is >= 0.80
    
    # Hysteresis and Cooldown
    DEESCALATION_MARGIN: float = 0.05
    DEESCALATION_CYCLES_REQUIRED: int = 2
    COOLDOWN_HOURS: int = 6
    
    # SMS Dispatch Provider (Carrier Simulator for College Project or Custom Gateway)
    SMS_MODE: str = os.getenv("SMS_MODE", "simulator") # "simulator" or "live"
    SMS_PROVIDER: str = os.getenv("SMS_PROVIDER", "simulator") # "simulator" or "live"
    SMS_SENDER_ID: str = os.getenv("SMS_SENDER_ID", "MYTEXT")
    
    # Open-Meteo API
    OPEN_METEO_BASE_URL: str = "https://api.open-meteo.com/v1/forecast"

settings = Settings()
