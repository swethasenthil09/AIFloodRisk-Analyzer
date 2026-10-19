"""
OASIS Common Alerting Protocol (CAP v1.2) Formatter.
Generates interoperable XML and JSON alert documents for disaster management ingestion (NDMA / TNSDMA).
"""

import uuid
from datetime import datetime, timedelta
from typing import Dict, Any

class CAPBuilder:
    """Builds standard CAP v1.2 alert payloads."""

    @staticmethod
    def build_cap_json(
        alert_id: str,
        ward_id: str,
        ward_number: int,
        ward_name: str,
        tier: str,
        probability: float,
        headline_en: str,
        description_en: str,
        headline_ta: str,
        description_ta: str,
        expires_at: datetime,
        area_polygon: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Returns standard CAP v1.2 JSON representation."""
        now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S+05:30")
        exp_str = expires_at.strftime("%Y-%m-%dT%H:%M:%S+05:30")

        # Map internal tiers to CAP urgency, severity, certainty
        tier_mapping = {
            "red": {"urgency": "Immediate", "severity": "Extreme", "certainty": "Observed"},
            "orange": {"urgency": "Expected", "severity": "Severe", "certainty": "Likely"},
            "yellow": {"urgency": "Future", "severity": "Moderate", "certainty": "Possible"}
        }
        cap_props = tier_mapping.get(tier.lower(), tier_mapping["yellow"])

        return {
            "identifier": f"IN-TN-CBE-{alert_id}",
            "sender": "alerts@floodrisk.coimbatore.gov.in",
            "sent": now_str,
            "status": "Actual",
            "msgType": "Alert",
            "scope": "Public",
            "code": ["IPAWS-CAP-1.2", "TNSDMA-ADVISORY"],
            "info": [
                {
                    "language": "en-IN",
                    "category": "Met",
                    "event": "Localized Flood Hazard Advisory",
                    "urgency": cap_props["urgency"],
                    "severity": cap_props["severity"],
                    "certainty": cap_props["certainty"],
                    "eventCode": [{"valueName": "SAME", "value": "FLW"}],
                    "expires": exp_str,
                    "headline": headline_en,
                    "description": description_en,
                    "instruction": "Avoid low-lying underpasses and open stormwater drains. Dial 1077 for emergency assistance.",
                    "parameter": [
                        {"valueName": "Ward_Number", "value": str(ward_number)},
                        {"valueName": "Calibrated_Probability", "value": f"{probability:.4f}"},
                        {"valueName": "Lead_Time_Hours", "value": "24"}
                    ],
                    "area": {
                        "areaDesc": f"Coimbatore Municipal Corporation Ward {ward_number} - {ward_name}",
                        "polygon": area_polygon.get("coordinates", [])
                    }
                },
                {
                    "language": "ta-IN",
                    "category": "Met",
                    "event": "உள்ளூர் வெள்ள அபாய எச்சரிக்கை",
                    "urgency": cap_props["urgency"],
                    "severity": cap_props["severity"],
                    "certainty": cap_props["certainty"],
                    "expires": exp_str,
                    "headline": headline_ta,
                    "description": description_ta,
                    "instruction": "தாழ்வான பகுதிகள் மற்றும் சுரங்கப்பாதைகளை தவிர்க்கவும். உதவி எண்: 1077."
                }
            ]
        }
