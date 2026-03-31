from __future__ import annotations

import asyncio
import math
import random
import string
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from auth import get_current_user
from database import get_db
from models import Delivery, HubBroadcast, Hub, Driver, DeliveryStatus, DeliveryBatch, User
from schemas import (
    DeliveryFailRequest, DeliveryFailResponse, HubOut, DeliveryCompleteResponse,
    OTPVerifyRequest, OTPVerifyResponse,
)
from websocket_manager import manager
from services import fcm as fcm_service

router = APIRouter(prefix="/delivery", tags=["delivery"])


def haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def _advance_queue(delivery: Delivery, db: AsyncSession) -> Optional[Delivery]:
    """Find the next delivery in the batch, set it to en_route, return it (or None)."""
    if delivery.batch_id is None or delivery.queue_position is None:
        return None

    next_result = await db.execute(
        select(Delivery).where(
            Delivery.batch_id == delivery.batch_id,
            Delivery.queue_position == delivery.queue_position + 1,
        )
    )
    next_delivery = next_result.scalar_one_or_none()
    if next_delivery:
        next_delivery.status = DeliveryStatus.en_route
        await db.commit()
    return next_delivery


async def _push_next_or_complete(delivery: Delivery, db: AsyncSession):
    """After a delivery finishes, push WS event for next delivery or batch completion."""
    next_delivery = await _advance_queue(delivery, db)
    if next_delivery:
        await manager.broadcast("next_delivery", {
            "driver_id": delivery.driver_id,
            "delivery": {
                "id": next_delivery.id,
                "order_id": next_delivery.order_id,
                "address": next_delivery.address,
                "status": next_delivery.status.value,
                "recipient_name": next_delivery.recipient_name,
                "package_size": next_delivery.package_size.value if hasattr(next_delivery.package_size, "value") else next_delivery.package_size,
                "weight_kg": next_delivery.weight_kg,
                "queue_position": next_delivery.queue_position,
            },
        })
    elif delivery.batch_id is not None:
        # Count totals for the summary
        batch_result = await db.execute(select(DeliveryBatch).where(DeliveryBatch.id == delivery.batch_id))
        batch = batch_result.scalar_one_or_none()

        delivered_result = await db.execute(
            select(Delivery).where(
                Delivery.batch_id == delivery.batch_id,
                Delivery.status == DeliveryStatus.delivered,
            )
        )
        delivered_count = len(delivered_result.scalars().all())

        hub_result = await db.execute(
            select(Delivery).where(
                Delivery.batch_id == delivery.batch_id,
                Delivery.status == DeliveryStatus.hub_delivered,
            )
        )
        hub_count = len(hub_result.scalars().all())

        if batch:
            batch.status = "completed"
            await db.commit()

        await manager.broadcast("batch_complete", {
            "driver_id": delivery.driver_id,
            "batch_code": batch.batch_code if batch else "",
            "total": batch.total_deliveries if batch else 0,
            "delivered": delivered_count,
            "hub_drops": hub_count,
        })


@router.post("/fail", response_model=DeliveryFailResponse)
async def fail_delivery(req: DeliveryFailRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Delivery).where(Delivery.id == req.delivery_id))
    delivery = result.scalar_one_or_none()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    delivery.status = DeliveryStatus.failed
    await db.commit()

    # Find nearby hubs
    hubs_result = await db.execute(select(Hub).where(Hub.availability == True))
    all_hubs = hubs_result.scalars().all()

    nearby = []
    for hub in all_hubs:
        dist = haversine(req.driver_lat, req.driver_lng, hub.lat, hub.lng)
        if dist <= 2000:
            nearby.append((dist, hub))

    nearby.sort(key=lambda x: x[0])
    top3 = nearby[:3]

    hub_list = []
    for dist, hub in top3:
        eta = int(dist / 250)
        hub_out = HubOut(
            id=hub.id,
            name=hub.name,
            owner_name=hub.owner_name,
            lat=hub.lat,
            lng=hub.lng,
            hub_type=hub.hub_type.value if hasattr(hub.hub_type, 'value') else hub.hub_type,
            availability=hub.availability,
            trust_score=hub.trust_score,
            today_earnings=hub.today_earnings,
            distance_m=round(dist),
            eta_minutes=max(1, eta),
        )
        hub_list.append(hub_out)

    # Create broadcast record
    broadcast = HubBroadcast(delivery_id=delivery.id)
    db.add(broadcast)
    await db.commit()

    # Emit WebSocket event
    driver_result = await db.execute(select(Driver).where(Driver.id == delivery.driver_id))
    driver = driver_result.scalar_one_or_none()
    await manager.broadcast("delivery_failed", {
        "delivery_id": delivery.id,
        "driver_id": delivery.driver_id,
        "driver_name": driver.name if driver else "Unknown",
        "address": delivery.address,
        "hub_count": len(hub_list),
    })

    # Do NOT advance queue — wait for hub_confirm_pickup
    for _, hub in top3:
        asyncio.ensure_future(
            fcm_service.send_broadcast_to_hub(
                fcm_token=None,
                delivery_address=delivery.address,
                package_size=delivery.package_size.value if hasattr(delivery.package_size, "value") else str(delivery.package_size),
            )
        )

    return DeliveryFailResponse(
        success=True,
        delivery_id=delivery.id,
        nearby_hubs=hub_list,
    )


@router.post("/{delivery_id}/complete", response_model=DeliveryCompleteResponse)
async def complete_delivery(
    delivery_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Delivery).where(Delivery.id == delivery_id))
    delivery = result.scalar_one_or_none()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    delivery.status = DeliveryStatus.delivered
    delivery.delivered_at = datetime.utcnow()
    await db.commit()

    await manager.broadcast("delivery_completed", {
        "delivery_id": delivery.id,
        "driver_id": delivery.driver_id,
        "address": delivery.address,
    })

    # Advance the batch queue
    await _push_next_or_complete(delivery, db)

    return DeliveryCompleteResponse(success=True, delivery_id=delivery.id)


@router.post("/{delivery_id}/verify-otp", response_model=OTPVerifyResponse)
async def verify_otp(
    delivery_id: int,
    req: OTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Delivery).where(Delivery.id == delivery_id))
    delivery = result.scalar_one_or_none()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    if not delivery.hub_otp:
        raise HTTPException(status_code=400, detail="No OTP generated for this delivery")

    # Check expiry (48 hours)
    if delivery.hub_otp_sent_at is None or \
       datetime.utcnow() - delivery.hub_otp_sent_at > timedelta(hours=48):
        return OTPVerifyResponse(verified=False, message="OTP expired")

    if delivery.hub_otp != req.otp:
        return OTPVerifyResponse(verified=False, message="Invalid OTP")

    delivery.hub_otp_verified = True
    await db.commit()

    return OTPVerifyResponse(
        verified=True,
        customer_name=delivery.recipient_name,
        package_id=delivery.order_id,
    )


@router.post("/{delivery_id}/resend-otp")
async def resend_otp(
    delivery_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Delivery)
        .options(selectinload(Delivery.broadcast))
        .where(Delivery.id == delivery_id)
    )
    delivery = result.scalar_one_or_none()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    if not delivery.customer_email:
        raise HTTPException(status_code=400, detail="No customer email on file for this delivery")

    # Find the hub that accepted this delivery
    hub_name = "NearDrop Hub"
    hub_address = ""
    if delivery.broadcast and delivery.broadcast.hub_id:
        hub_result = await db.execute(select(Hub).where(Hub.id == delivery.broadcast.hub_id))
        hub = hub_result.scalar_one_or_none()
        if hub:
            hub_name = hub.name
            hub_address = f"{hub.lat:.4f}, {hub.lng:.4f}"

    new_otp = ''.join(random.choices(string.digits, k=6))
    delivery.hub_otp = new_otp
    delivery.hub_otp_sent_at = datetime.utcnow()
    delivery.hub_otp_verified = False
    await db.commit()

    from services.email_service import send_otp_email
    background_tasks.add_task(
        send_otp_email,
        customer_email=delivery.customer_email,
        customer_name=delivery.recipient_name or "Customer",
        otp=new_otp,
        hub_name=hub_name,
        hub_address=hub_address,
        package_id=delivery.order_id or str(delivery.id),
    )

    return {"success": True, "message": "New OTP sent to customer"}
