import logging
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
import os
from google import genai
from google.genai import types

from database import get_db
from models import Delivery, Driver

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public", tags=["Public"])

# --- Schemas ---
class FreightIQRequest(BaseModel):
    origin: str
    destination: str
    cargo_type: str
    weight: str
    timeline: str
    history: Optional[List[Dict[str, str]]] = None  # Format: [{"role": "user", "content": "..."}, ...]

class FreightIQResponse(BaseModel):
    reply: str

class PublicTrackingResponse(BaseModel):
    order_id: str
    status: str
    recipient_name: Optional[str]
    address: str
    driver_name: Optional[str]
    driver_lat: Optional[float]
    driver_lng: Optional[float]

# --- Endpoints ---

@router.get("/track/{tracking_id}", response_model=PublicTrackingResponse)
async def track_shipment(tracking_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Delivery).where(Delivery.order_id == tracking_id))
    delivery = result.scalar_one_or_none()
    
    if not delivery:
        raise HTTPException(status_code=404, detail="Shipment not found")
        
    driver_name = None
    driver_lat = None
    driver_lng = None
    
    if delivery.driver_id:
        driver_res = await db.execute(select(Driver).where(Driver.id == delivery.driver_id))
        driver = driver_res.scalar_one_or_none()
        if driver:
            driver_name = driver.name
            if delivery.status in ["en_route", "arrived"]:
                driver_lat = driver.lat
                driver_lng = driver.lng
                
    return PublicTrackingResponse(
        order_id=delivery.order_id or str(delivery.id),
        status=delivery.status,
        recipient_name=delivery.recipient_name,
        address=delivery.address,
        driver_name=driver_name,
        driver_lat=driver_lat,
        driver_lng=driver_lng
    )


@router.post("/freight-iq", response_model=FreightIQResponse)
async def freight_iq_estimate(req: FreightIQRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY is not set.")
        raise HTTPException(status_code=500, detail="Estimation service configuration error.")

    client = genai.Client(api_key=api_key)
    
    system_instruction = (
        "You are FreightIQ, an advanced AI quoting and negotiation assistant for logistics. "
        "Your goal is to help small and medium exporters get fair shipping rates by scraping and analyzing live public freight indices "
        "(like Freightos Baltic Index, Xeneta) and historical patterns. "
        "Always provide a simulated but highly realistic analysis of the current market rate for the requested lane. "
        "Keep your answers concise, professional, and directly actionable. "
        "If a user mentions a quote they received, tell them if it's fair or above market, and give them specific counter-offer advice. "
        "Do not refuse to provide a quote; confidently provide a realistic estimate range based on current global trends."
    )
    
    # Build conversation history
    contents = []
    
    # First message incorporates the specific shipment details if this is the start of the chat
    initial_user_prompt = f"I want to ship {req.weight} of {req.cargo_type} from {req.origin} to {req.destination}. Timeline: {req.timeline}. What is the current market rate and what should I know?"
    
    if req.history:
        for msg in req.history:
            role = "user" if msg.get("role") == "user" else "model"
            contents.append(
                types.Content(role=role, parts=[types.Part.from_text(text=msg.get("content", ""))])
            )
        # We assume the latest message from user is already in the history, but if not, we'd add it.
        # However, to be safe, if history is provided, we just pass it as is to continue the conversation.
    else:
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=initial_user_prompt)]))

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3
            )
        )
        return FreightIQResponse(reply=response.text or "I could not generate an estimate at this time.")
    except Exception as e:
        logger.exception("Error calling Gemini API: %s", e)
        raise HTTPException(status_code=500, detail="Failed to calculate estimation.")
