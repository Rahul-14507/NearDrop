from __future__ import annotations

import logging
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["voice"])


@router.post("/azure-token")
async def get_azure_speech_token(current_user: User = Depends(get_current_user)):
    """Return a short-lived Azure Cognitive Services token for the Flutter client to use directly."""
    speech_key = os.getenv("AZURE_SPEECH_KEY")
    speech_region = os.getenv("AZURE_SPEECH_REGION", "eastus")

    if not speech_key:
        logger.warning("AZURE_SPEECH_KEY not set — returning demo token")
        return {"token": "demo-token", "region": speech_region}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"https://{speech_region}.api.cognitive.microsoft.com/sts/v1.0/issueToken",
                headers={"Ocp-Apim-Subscription-Key": speech_key},
            )
            resp.raise_for_status()
            token = resp.text
        return {"token": token, "region": speech_region}
    except Exception as e:
        logger.error(f"Azure Speech token fetch failed: {e}")
        raise HTTPException(status_code=502, detail="Failed to retrieve speech token")
