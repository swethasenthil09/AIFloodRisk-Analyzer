"""
Post-Event Sentinel-1 SAR & U-Net Analysis Router.
Exposes surface water inundation mapping, building/road infrastructure exposure,
and validation against pre-event operational predictions.
"""

from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

from ml.sar_unet import Sentinel1AnalysisService

router = APIRouter(prefix="/api/sar", tags=["Sentinel-1 SAR Analysis"])

sar_service = Sentinel1AnalysisService()

class SARProcessRequest(BaseModel):
    scene_id: Optional[str] = "S1A_IW_GRDH_20241016_COIMBATORE_MONSOON"

@router.get("/latest")
def get_latest_sar_analysis():
    """Returns the latest post-event SAR inundation mapping and exposure evaluation."""
    return sar_service.simulate_or_process_scene()

@router.post("/process")
def trigger_sar_processing(req: SARProcessRequest):
    """Processes or simulates a new Sentinel-1 SAR acquisition over Coimbatore."""
    scene_id = req.scene_id or "S1A_IW_GRDH_COIMBATORE_RECENT"
    return sar_service.simulate_or_process_scene(scene_id=scene_id)
