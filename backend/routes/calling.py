from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from auth import get_current_user
from database import get_db
from models import Delivery, Driver, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/call", tags=["calling"])


class CallTokenResponse(BaseModel):
    token: str
    user_id: str
    expires_on: str


class InitiateCallRequest(BaseModel):
    delivery_id: int


class InitiateCallResponse(BaseModel):
    call_id: str
    status: str


@router.post("/token", response_model=CallTokenResponse)
async def get_call_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate an ACS user access token for VoIP calling."""
    connection_string = os.getenv("AZURE_COMMUNICATION_CONNECTION_STRING")
    if not connection_string:
        logger.error("AZURE_COMMUNICATION_CONNECTION_STRING not configured")
        raise HTTPException(
            status_code=503,
            detail={"error": "calling_service_unavailable"},
        )

    try:
        from azure.communication.identity import (
            CommunicationIdentityClient,
            CommunicationUserIdentifier,
        )

        acs_client = CommunicationIdentityClient.from_connection_string(connection_string)

        # Resolve the Driver record linked to this user
        driver: Driver | None = None
        if current_user.driver_id is not None:
            driver_result = await db.execute(
                select(Driver).where(Driver.id == current_user.driver_id)
            )
            driver = driver_result.scalar_one_or_none()

        if driver is not None and driver.acs_user_id:
            # Re-use existing ACS identity
            acs_user = CommunicationUserIdentifier(driver.acs_user_id)
        else:
            # Create a new ACS user
            acs_user = acs_client.create_user()
            acs_user_id = acs_user.properties.get("id") or acs_user.id  # type: ignore[attr-defined]
            if driver is not None:
                driver.acs_user_id = acs_user_id
                db.add(driver)
                await db.commit()

        token_response = acs_client.get_token(acs_user, ["voip"])
        token_value = token_response.token
        expires_on_iso = token_response.expires_on.isoformat()
        acs_id = acs_user.properties.get("id") or acs_user.id  # type: ignore[attr-defined]

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("ACS token generation failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail={"error": "calling_service_unavailable"},
        )

    return CallTokenResponse(
        token=token_value,
        user_id=acs_id,
        expires_on=expires_on_iso,
    )


@router.post("/initiate", response_model=InitiateCallResponse)
async def initiate_call(
    req: InitiateCallRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate an outbound PSTN call to the customer associated with a delivery."""
    connection_string = os.getenv("AZURE_COMMUNICATION_CONNECTION_STRING")
    caller_phone = os.getenv("AZURE_COMMUNICATION_PHONE_NUMBER")

    if not connection_string or not caller_phone:
        logger.error(
            "ACS connection string or phone number not configured"
        )
        raise HTTPException(
            status_code=503,
            detail={"error": "calling_service_unavailable"},
        )

    # Fetch delivery
    delivery_result = await db.execute(
        select(Delivery).where(Delivery.id == req.delivery_id)
    )
    delivery = delivery_result.scalar_one_or_none()
    if delivery is None:
        raise HTTPException(status_code=404, detail="Delivery not found")

    customer_phone = delivery.customer_phone
    if not customer_phone:
        raise HTTPException(
            status_code=400,
            detail="No customer phone number on record for this delivery",
        )

    try:
        from azure.communication.callautomation import (
            CallAutomationClient,
            PhoneNumberIdentifier,
        )

        call_client = CallAutomationClient.from_connection_string(connection_string)

        target = PhoneNumberIdentifier(customer_phone)
        caller_id = PhoneNumberIdentifier(caller_phone)

        result = call_client.create_call(
            target_participant=target,
            callback_url=os.getenv(
                "ACS_CALLBACK_URL",
                "https://neardrop.example.com/call/events",
            ),
            source_caller_id_number=caller_id,
        )

        call_id = result.call_connection_id

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("ACS call initiation failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail={"error": "calling_service_unavailable"},
        )

    return InitiateCallResponse(call_id=call_id, status="initiated")
