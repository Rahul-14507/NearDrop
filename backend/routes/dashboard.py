from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date, timedelta

from database import get_db
from models import Driver, Delivery, DeliveryStatus, HubBroadcast
from schemas import DashboardStats, FleetDriver, HourlyMetric, LeaderboardEntry

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    total_result = await db.execute(
        select(func.count(Delivery.id)).where(Delivery.created_at >= today_start)
    )
    total = total_result.scalar() or 0

    delivered_result = await db.execute(
        select(func.count(Delivery.id)).where(
            Delivery.created_at >= today_start,
            Delivery.status == DeliveryStatus.delivered,
        )
    )
    delivered = delivered_result.scalar() or 0

    failed_result = await db.execute(
        select(func.count(Delivery.id)).where(
            Delivery.created_at >= today_start,
            Delivery.status == DeliveryStatus.failed,
        )
    )
    failed = failed_result.scalar() or 0

    reroutes_result = await db.execute(
        select(func.count(HubBroadcast.id)).where(
            HubBroadcast.broadcast_at >= today_start,
            HubBroadcast.accepted_at != None,
        )
    )
    reroutes = reroutes_result.scalar() or 0

    active_result = await db.execute(select(func.count(Driver.id)))
    active_drivers = active_result.scalar() or 0

    success_rate = round((delivered / total * 100), 1) if total > 0 else 0.0
    co2_saved = round(reroutes * 0.8, 2)  # 800g CO₂ saved per rerouted delivery

    return DashboardStats(
        total_deliveries=total,
        first_attempt_success_rate=success_rate,
        hub_reroutes=reroutes,
        co2_saved_kg=co2_saved,
        active_drivers=active_drivers,
    )


@router.get("/fleet", response_model=list[FleetDriver])
async def get_fleet(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Driver))
    drivers = result.scalars().all()

    fleet = []
    for driver in drivers:
        latest_delivery = await db.execute(
            select(Delivery)
            .where(Delivery.driver_id == driver.id)
            .order_by(Delivery.created_at.desc())
            .limit(1)
        )
        delivery = latest_delivery.scalar_one_or_none()

        fleet.append(FleetDriver(
            id=driver.id,
            name=driver.name,
            lat=driver.lat,
            lng=driver.lng,
            status=driver.status.value if hasattr(driver.status, 'value') else driver.status,
            trust_score=driver.trust_score,
            current_delivery=delivery.address if delivery else None,
        ))
    return fleet


@router.get("/hourly", response_model=list[HourlyMetric])
async def get_hourly_metrics(db: AsyncSession = Depends(get_db)):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(Delivery).where(Delivery.created_at >= today_start)
    )
    deliveries = result.scalars().all()

    by_hour: dict[int, dict] = {h: {"deliveries": 0, "failures": 0} for h in range(0, 24)}
    for d in deliveries:
        h = d.created_at.hour
        by_hour[h]["deliveries"] += 1
        status = d.status.value if hasattr(d.status, 'value') else d.status
        if status == "failed":
            by_hour[h]["failures"] += 1

    return [
        HourlyMetric(hour=h, deliveries=v["deliveries"], failures=v["failures"])
        for h, v in by_hour.items()
        if v["deliveries"] > 0
    ]


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(db: AsyncSession = Depends(get_db)):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(select(Driver))
    drivers = result.scalars().all()

    entries = []
    for driver in drivers:
        count_result = await db.execute(
            select(func.count(Delivery.id)).where(
                Delivery.driver_id == driver.id,
                Delivery.status == DeliveryStatus.delivered,
                Delivery.created_at >= today_start,
            )
        )
        count = count_result.scalar() or 0

        score = driver.trust_score
        trend = "up" if score >= 90 else ("down" if score < 75 else "stable")

        entries.append((count, score, driver))

    entries.sort(key=lambda x: (-x[0], -x[1]))

    return [
        LeaderboardEntry(
            rank=i + 1,
            driver_id=e[2].id,
            name=e[2].name,
            deliveries_completed=e[0],
            trust_score=e[1],
            trend=("up" if e[1] >= 90 else ("down" if e[1] < 75 else "stable")),
        )
        for i, e in enumerate(entries)
    ]
