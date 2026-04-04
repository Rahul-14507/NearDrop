import logging
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
import os
from openai import AsyncAzureOpenAI

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
    api_key = os.getenv("AZURE_OPENAI_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")

    if not api_key or not endpoint:
        logger.error("AZURE_OPENAI_KEY or AZURE_OPENAI_ENDPOINT is not set.")
        raise HTTPException(status_code=500, detail="Estimation service configuration error.")

    # Clean endpoint (remove trailing slashes) to avoid malformed URLs
    endpoint = endpoint.rstrip("/")

    client = AsyncAzureOpenAI(
        api_key=api_key,
        api_version="2024-05-01-preview",  # Using a more robust version for Foundry
        azure_endpoint=endpoint
    )
    
    system_instruction = (
        "You are FreightIQ, a professional Freight Quotation and Market Intelligence Generator. "
        "Your sole purpose is to provide highly accurate, formal, and structured freight estimates based on global market indices. "
        "DO NOT use conversational language. No introductory filler like 'Hello', 'Sure', or 'As an AI'. "
        "Your output must follow this strict format: "
        "1. Heading: ## OFFICIAL FREIGHT QUOTATION / MARKET ESTIMATE \n"
        "2. Section: ### Lane Summary (Origin, Destination, Cargo) \n"
        "3. Section: ### Price Breakdown (Provide a Markdown table with 'Charge Item', 'Market Rate Range', and 'Unit') \n"
        "4. Section: ### Key Transit & Surcharges (Port fees, documentation, etc.) \n"
        "5. Section: ### Market Intelligence Insight (Briefly explain why the rate is at this level based on current global trends). \n"
        "Always provide a realistic price range. Be confident and authoritative. "
        "If a user provides a competitor quote, analyze it formally as 'Competitor Quote Analysis' and provide counter-offer strategies."
    )
    
    # Build conversation history
    messages = [{"role": "system", "content": system_instruction}]
    
    initial_user_prompt = f"I want to ship {req.weight} of {req.cargo_type} from {req.origin} to {req.destination}. Timeline: {req.timeline}. What is the current market rate and what should I know?"
    
    if req.history:
        for msg in req.history:
            role = "assistant" if msg.get("role") == "model" else msg.get("role", "user")
            messages.append({"role": role, "content": msg.get("content", "")})
    else:
        messages.append({"role": "user", "content": initial_user_prompt})

    try:
        logger.info("Calling Azure OpenAI with deployment: %s at %s", deployment, endpoint)
        response = await client.chat.completions.create(
            model=deployment,
            messages=messages,
            temperature=0.3
        )
        return FreightIQResponse(reply=response.choices[0].message.content or "I could not generate an estimate at this time.")
    except Exception as e:
        logger.exception("Error calling Azure OpenAI API: %s", e)
        raise HTTPException(status_code=500, detail="Failed to calculate estimation.")
