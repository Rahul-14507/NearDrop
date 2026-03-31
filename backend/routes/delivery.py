from __future__ import annotations

import asyncio
import math
import random
import string
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from auth import get_current_user
from database import get_db
from models import Delivery, HubBroadcast, Hub, Driver, DeliveryStatus, User
from schemas import DeliveryFailRequest, DeliveryFailResponse, HubOut, DeliveryCompleteResponse
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


@router.post("/fail", response_model=DeliveryFailResponse)
async def fail_delivery(req: DeliveryFailRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Delivery).where(Delivery.id == req.delivery_id))
    delivery = result.scalar_one_or_none()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    delivery.status = "failed"
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
        eta = int(dist / 250)  # ~15km/h walking estimate
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

    # Fire-and-forget FCM push to nearby hub owners
    for _, hub in top3:
        asyncio.ensure_future(
            fcm_service.send_broadcast_to_hub(
                fcm_token=None,  # Hub FCM tokens would be stored on Hub model in future
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

    return DeliveryCompleteResponse(success=True, delivery_id=delivery.id)
