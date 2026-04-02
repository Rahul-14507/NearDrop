from __future__ import annotations

import logging
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional

from auth import get_current_user
from models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tts", tags=["tts"])

_DEFAULT_VOICES = {
    "hi-IN": "hi-IN-SwaraNeural",
    "en-IN": "en-IN-NeerjaNeural",
}


class TTSSynthesizeRequest(BaseModel):
    text: str
    language: str = "en-IN"
    voice: Optional[str] = None


@router.post("/synthesize")
async def synthesize_speech(
    req: TTSSynthesizeRequest,
    current_user: User = Depends(get_current_user),
):
    """Synthesize speech via Azure TTS and return audio/mpeg binary."""
    speech_key = os.getenv("AZURE_SPEECH_KEY")
    speech_region = os.getenv("AZURE_SPEECH_REGION", "eastus")

    if not speech_key:
        logger.error("AZURE_SPEECH_KEY not configured")
        raise HTTPException(
            status_code=503,
            detail={"error": "tts_service_unavailable"},
        )

    voice = req.voice or _DEFAULT_VOICES.get(req.language, "en-IN-NeerjaNeural")

    ssml = (
        f"<speak version='1.0' xml:lang='{req.language}'>"
        f"<voice name='{voice}'>{req.text}</voice>"
        f"</speak>"
    )

    tts_url = (
        f"https://{speech_region}.tts.speech.microsoft.com/cognitiveservices/v1"
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                tts_url,
                headers={
                    "Ocp-Apim-Subscription-Key": speech_key,
                    "Content-Type": "application/ssml+xml",
                    "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
                },
                content=ssml.encode("utf-8"),
            )
            resp.raise_for_status()
            audio_bytes = resp.content
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Azure TTS HTTP error %s: %s", exc.response.status_code, exc.response.text
        )
        raise HTTPException(
            status_code=503,
            detail={"error": "tts_service_unavailable"},
        )
    except Exception as exc:
        logger.error("Azure TTS call failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail={"error": "tts_service_unavailable"},
        )

    return Response(content=audio_bytes, media_type="audio/mpeg")
