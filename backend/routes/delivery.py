from __future__ import annotations

import asyncio
import math
import random
import re
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
                "lat": next_delivery.lat,
                "lng": next_delivery.lng,
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
        if dist <= 5000:  # Expanded to 5km for better coverage
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

    # Auto-assign the closest hub: create broadcast and accept it immediately
    auto_hub_payload = None
    if top3:
        best_dist, best_hub = top3[0]
        pickup_code = "".join(random.choices(string.digits, k=6))

        # Create and immediately accept the broadcast
        broadcast = HubBroadcast(
            delivery_id=delivery.id,
            hub_id=best_hub.id,
            pickup_code=pickup_code,
            accepted_at=datetime.utcnow(),
        )
        db.add(broadcast)

        # Update hub stats
        best_hub.current_load = (best_hub.current_load or 0) + 1
        best_hub.today_earnings = (best_hub.today_earnings or 0) + 25.0

        # Generate customer OTP
        otp = "".join(random.choices(string.digits, k=6))
        delivery.hub_otp = otp
        delivery.hub_otp_sent_at = datetime.utcnow()
        delivery.hub_otp_verified = False
        delivery.hub_id = best_hub.id

        await db.commit()

        auto_hub_payload = {
            "id": best_hub.id,
            "name": best_hub.name,
            "lat": best_hub.lat,
            "lng": best_hub.lng,
            "distance_m": round(best_dist),
            "eta_minutes": max(1, int(best_dist / 250)),
            "pickup_code": pickup_code,
            "hub_type": best_hub.hub_type.value if hasattr(best_hub.hub_type, 'value') else str(best_hub.hub_type),
            "trust_score": best_hub.trust_score,
        }

    # Emit WebSocket event with the assigned hub
    driver_result = await db.execute(select(Driver).where(Driver.id == delivery.driver_id))
    driver = driver_result.scalar_one_or_none()
    await manager.broadcast("delivery_failed", {
        "delivery_id": delivery.id,
        "driver_id": delivery.driver_id,
        "driver_name": driver.name if driver else "Unknown",
        "address": delivery.address,
        "hub_count": len(hub_list),
        "assigned_hub": auto_hub_payload,  # The hub the driver should go to
    })

    # Send email OTP to customer if available
    if auto_hub_payload and delivery.customer_email:
        asyncio.ensure_future(
            _send_hub_otp_email(
                delivery=delivery,
                hub=top3[0][1] if top3 else None,
                otp=delivery.hub_otp or "",
            )
        )

    # FCM push to hub owners (best effort)
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


async def _send_hub_otp_email(delivery: Delivery, hub, otp: str):
    """Best-effort: email OTP to customer after hub assignment."""
    try:
        if delivery.customer_email:
            from services.email_service import send_otp_email
            await send_otp_email(
                customer_email=delivery.customer_email,
                customer_name=delivery.recipient_name or "Customer",
                otp=otp,
                hub_name=hub.name if hub else "NearDrop Hub",
                hub_address=f"{hub.lat:.4f}, {hub.lng:.4f}" if hub else "",
                package_id=delivery.order_id or str(delivery.id),
            )
    except Exception:
        pass


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
        return OTPVerifyResponse(verified=False, message="No OTP has been generated for this delivery")

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


@router.post("/{delivery_id}/hub-complete", response_model=DeliveryCompleteResponse)
async def hub_complete_delivery(
    delivery_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Delivery).where(Delivery.id == delivery_id))
    delivery = result.scalar_one_or_none()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    delivery.status = DeliveryStatus.hub_delivered
    delivery.delivered_at = datetime.utcnow()
    await db.commit()

    await manager.broadcast("delivery_hub_completed", {
        "delivery_id": delivery.id,
        "driver_id": delivery.driver_id,
        "address": delivery.address,
    })

    # Advance the batch queue
    await _push_next_or_complete(delivery, db)

    return DeliveryCompleteResponse(success=True, delivery_id=delivery.id)


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

    if delivery.customer_email:
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

    return {"success": True, "message": "New OTP generated (no customer email on file)"}
