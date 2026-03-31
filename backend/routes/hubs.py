from __future__ import annotations

import asyncio
import math
import random
import string
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from database import get_db
from services import fcm as fcm_service
from models import Hub, HubBroadcast, Delivery, Driver, DeliveryBatch, DeliveryStatus
from schemas import (
    HubOut, HubAcceptRequest, HubAcceptResponse, HubStats,
    HubBroadcastOut, DeliveryOut, HubConfirmPickupRequest, StoredPackageOut,
)

router = APIRouter(tags=["hubs"])


def haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def _advance_queue_from_delivery(delivery: Delivery, db: AsyncSession):
    """Shared helper: advance batch queue and push WS event."""
    from routes.delivery import _push_next_or_complete
    await _push_next_or_complete(delivery, db)


@router.get("/hubs/nearby", response_model=list[HubOut])
async def get_nearby_hubs(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(default=500),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Hub).where(Hub.availability == True))
    all_hubs = result.scalars().all()

    nearby = []
    for hub in all_hubs:
        dist = haversine(lat, lng, hub.lat, hub.lng)
        if dist <= radius:
            eta = max(1, int(dist / 250))
            nearby.append((dist, hub, eta))

    nearby.sort(key=lambda x: x[0])

    output = []
    for dist, hub, eta in nearby[:3]:
        output.append(HubOut(
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
            eta_minutes=eta,
        ))
    return output


@router.get("/hubs/{hub_id}", response_model=HubOut)
async def get_hub(hub_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Hub).where(Hub.id == hub_id))
    hub = result.scalar_one_or_none()
    if not hub:
        return HubOut(id=0, name="Unknown Hub", lat=0, lng=0, hub_type="kirana", availability=False, trust_score=0, today_earnings=0)
    return hub


@router.get("/hubs/{hub_id}/stats", response_model=HubStats)
async def get_hub_stats(hub_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Hub).where(Hub.id == hub_id))
    hub = result.scalar_one_or_none()

    count_result = await db.execute(
        select(func.count(HubBroadcast.id)).where(
            HubBroadcast.hub_id == hub_id,
            HubBroadcast.accepted_at != None
        )
    )
    count = count_result.scalar() or 0

    return HubStats(
        hub_id=hub_id,
        name=hub.name if hub else "Unknown",
        today_earnings=hub.today_earnings if hub else 0,
        accepted_count=count,
        trust_score=hub.trust_score if hub else 0
    )


@router.get("/hubs/{hub_id}/active_broadcasts", response_model=list[HubBroadcastOut])
async def get_active_broadcasts(hub_id: int, db: AsyncSession = Depends(get_db)):
    hub_result = await db.execute(select(Hub).where(Hub.id == hub_id))
    hub = hub_result.scalar_one_or_none()
    if not hub:
        return []

    result = await db.execute(
        select(HubBroadcast)
        .options(selectinload(HubBroadcast.delivery))
        .where(HubBroadcast.accepted_at == None)
    )
    broadcasts = result.scalars().all()

    output = []
    for b in broadcasts:
        dist = haversine(hub.lat, hub.lng, hub.lat + 0.002, hub.lng + 0.002)
        output.append(HubBroadcastOut(
            id=b.id,
            delivery=DeliveryOut.model_validate(b.delivery),
            distance_m=round(dist),
            reward=25.0
        ))
    return output


@router.get("/hubs/{hub_id}/stored_packages", response_model=list[StoredPackageOut])
async def get_stored_packages(hub_id: int, db: AsyncSession = Depends(get_db)):
    """Packages that have been accepted at this hub and are awaiting customer pickup."""
    result = await db.execute(
        select(HubBroadcast)
        .options(selectinload(HubBroadcast.delivery))
        .where(
            HubBroadcast.hub_id == hub_id,
            HubBroadcast.accepted_at != None,
        )
    )
    broadcasts = result.scalars().all()

    output = []
    for b in broadcasts:
        if b.delivery and not b.delivery.hub_otp_verified:
            output.append(StoredPackageOut(
                delivery_id=b.delivery.id,
                order_id=b.delivery.order_id or str(b.delivery.id),
                address=b.delivery.address,
                recipient_name=b.delivery.recipient_name,
                hub_otp_verified=b.delivery.hub_otp_verified or False,
                hub_otp_sent_at=b.delivery.hub_otp_sent_at,
            ))
    return output


@router.post("/hub/accept", response_model=HubAcceptResponse)
async def accept_broadcast(
    req: HubAcceptRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(HubBroadcast).where(HubBroadcast.id == req.broadcast_id)
    )
    broadcast = result.scalar_one_or_none()

    hub_result = await db.execute(select(Hub).where(Hub.id == req.hub_id))
    hub = hub_result.scalar_one_or_none()

    pickup_code = "".join(random.choices(string.digits, k=6))

    if broadcast:
        broadcast.hub_id = req.hub_id
        broadcast.pickup_code = pickup_code
        broadcast.accepted_at = datetime.utcnow()

    if hub:
        hub.today_earnings += 25.0
        hub.current_load += 1

    await db.commit()

    # Load delivery and generate + email OTP to customer
    delivery = None
    if broadcast:
        delivery_result = await db.execute(select(Delivery).where(Delivery.id == broadcast.delivery_id))
        delivery = delivery_result.scalar_one_or_none()

        if delivery and delivery.customer_email:
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
                hub_name=hub.name if hub else "NearDrop Hub",
                hub_address=f"{hub.lat:.4f}, {hub.lng:.4f}" if hub else "",
                package_id=delivery.order_id or str(delivery.id),
            )

        # FCM push to driver
        if delivery:
            driver_result = await db.execute(select(Driver).where(Driver.id == delivery.driver_id))
            driver = driver_result.scalar_one_or_none()
            if driver and driver.fcm_token:
                asyncio.ensure_future(
                    fcm_service.send_hub_accepted_to_driver(
                        fcm_token=driver.fcm_token,
                        pickup_code=pickup_code,
                        hub_name=hub.name if hub else "Hub",
                    )
                )

    return HubAcceptResponse(
        success=True,
        pickup_code=pickup_code,
        hub_name=hub.name if hub else "Hub",
        delivery_id=broadcast.delivery_id if broadcast else 0,
    )


@router.post("/hub/confirm-pickup")
async def confirm_pickup(
    req: HubConfirmPickupRequest,
    db: AsyncSession = Depends(get_db),
):
    """Driver calls this after physically dropping the package at the hub."""
    result = await db.execute(select(Delivery).where(Delivery.id == req.delivery_id))
    delivery = result.scalar_one_or_none()
    if not delivery:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Delivery not found")

    delivery.status = DeliveryStatus.hub_delivered
    delivery.delivered_at = datetime.utcnow()
    await db.commit()

    from websocket_manager import manager
    await manager.broadcast("hub_pickup_confirmed", {
        "delivery_id": delivery.id,
        "driver_id": delivery.driver_id,
        "address": delivery.address,
    })

    # Advance queue
    await _advance_queue_from_delivery(delivery, db)

    return {"success": True, "delivery_id": delivery.id}
