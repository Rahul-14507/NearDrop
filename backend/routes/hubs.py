import math
import random
import string
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.models import Hub, HubBroadcast, Delivery
from backend.schemas import HubOut, HubAcceptRequest, HubAcceptResponse, HubStats, HubBroadcastOut, DeliveryOut

router = APIRouter(tags=["hubs"])


def haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


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

    # Eagerly load the delivery relationship using selectinload
    result = await db.execute(
        select(HubBroadcast)
        .options(selectinload(HubBroadcast.delivery))
        .where(HubBroadcast.accepted_at == None)
    )
    broadcasts = result.scalars().all()

    output = []
    for b in broadcasts:
        # Distance calculation
        dist = haversine(hub.lat, hub.lng, hub.lat + 0.002, hub.lng + 0.002) 
        output.append(HubBroadcastOut(
            id=b.id,
            delivery=DeliveryOut.from_orm(b.delivery),
            distance_m=round(dist),
            reward=25.0
        ))
    return output


@router.post("/hub/accept", response_model=HubAcceptResponse)
async def accept_broadcast(req: HubAcceptRequest, db: AsyncSession = Depends(get_db)):
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

    return HubAcceptResponse(
        success=True,
        pickup_code=pickup_code,
        hub_name=hub.name if hub else "Hub",
        delivery_id=broadcast.delivery_id if broadcast else 0,
    )
