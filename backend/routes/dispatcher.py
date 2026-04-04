from __future__ import annotations

import asyncio
import csv
import io
import logging
import random
import string
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from auth import get_current_dispatcher, get_current_user
from database import get_db
from models import (
    Delivery, DeliveryBatch, DeliveryStatus, Dispatcher, Driver,
    Hub, HubBroadcast, HubType, PackageSize, User,
)
from schemas import (
    BatchAcceptResponse, BatchRejectRequest, BatchUploadResponse,
    DispatcherBatchOut, DispatcherDeliveryListOut,
    DispatcherDeliveryOut, DispatcherDriverOut, DispatcherHubOut,
    DispatcherStatsOut, HubDropHistoryItem, RegisterHubRequest,
    UpdateHubRequest,
)
from services.azure_maps import geocode_address
from services.queue_engine import order_delivery_queue
from services.trust_score_engine import calculate_trust_score
from services.sustainability_engine import calculate_sustainability
from services.cost_optimization_engine import calculate_cost_savings
from websocket_manager import manager
from services import fcm as fcm_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dispatcher", tags=["dispatcher"])


# ─── Driver Management ────────────────────────────────────────────────────────

@router.get("/drivers", response_model=list[DispatcherDriverOut])
async def list_drivers(
    city: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: Dispatcher = Depends(get_current_dispatcher),
):
    window_start = datetime.utcnow() - timedelta(days=7)
    active_threshold = datetime.utcnow() - timedelta(hours=24)

    query = select(Driver)
    if city and city != "All Cities":
        query = query.where(Driver.city == city)
    result = await db.execute(query)
    drivers = result.scalars().all()

    output = []
    for driver in drivers:
        is_active = (
            driver.last_ping_at is not None
            and driver.last_ping_at >= active_threshold
        )

        assigned_result = await db.execute(
            select(func.count(Delivery.id)).where(
                Delivery.driver_id == driver.id,
                Delivery.created_at >= window_start,
            )
        )
        today_assigned = assigned_result.scalar() or 0

        completed_result = await db.execute(
            select(func.count(Delivery.id)).where(
                Delivery.driver_id == driver.id,
                Delivery.created_at >= window_start,
                Delivery.status == DeliveryStatus.delivered,
            )
        )
        today_completed = completed_result.scalar() or 0

        failed_result = await db.execute(
            select(func.count(Delivery.id)).where(
                Delivery.driver_id == driver.id,
                Delivery.created_at >= window_start,
                Delivery.status == DeliveryStatus.failed,
            )
        )
        today_failed = failed_result.scalar() or 0

        # Calculate dynamic trust score
        driver_perf = calculate_trust_score(
            driver_id=str(driver.id),
            on_time_completion=min(100.0, (today_completed / (today_assigned or 1)) * 100.0),
            recovery_success=85.0 if today_completed > 0 else 50.0,
            sla_adherence=90.0,
            delivery_confirmation=95.0,
            heartbeat_reliability=100.0 if is_active else 40.0,
            historical_score=driver.trust_score
        )

        output.append(DispatcherDriverOut(
            id=driver.id,
            name=driver.name,
            phone=driver.phone,
            is_active=is_active,
            current_lat=driver.lat,
            current_lng=driver.lng,
            today_assigned=today_assigned,
            today_completed=today_completed,
            today_failed=today_failed,
            trust_score=driver_perf["trust_score"],
            band=driver_perf["band"],
            city=driver.city,
        ))
    return output


# ─── Batch Upload ─────────────────────────────────────────────────────────────

@router.post("/batch/upload", response_model=BatchUploadResponse)
async def upload_batch(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    driver_id: int = Form(...),
    db: AsyncSession = Depends(get_db),
    current_dispatcher: Dispatcher = Depends(get_current_dispatcher),
):
    # Verify driver exists
    driver_result = await db.execute(select(Driver).where(Driver.id == driver_id))
    driver = driver_result.scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    # Parse CSV
    contents = await file.read()
    try:
        text = contents.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = contents.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty or has no rows")

    required_cols = {"delivery_id", "customer_name", "customer_email", "customer_phone", "delivery_address"}
    actual_cols = set(reader.fieldnames or [])
    missing = required_cols - actual_cols
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing CSV columns: {missing}")

    # Generate batch code
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    count_result = await db.execute(
        select(func.count(DeliveryBatch.id)).where(DeliveryBatch.assigned_at >= today_start)
    )
    today_count = count_result.scalar() or 0
    batch_code = f"BATCH-{datetime.utcnow().strftime('%Y%m%d')}-{today_count + 1:03d}"

    # Geocode addresses concurrently
    addresses = [row.get("delivery_address", "") for row in rows]
    geo_results = await asyncio.gather(
        *[geocode_address(addr) for addr in addresses],
        return_exceptions=True,
    )

    # Create batch
    batch = DeliveryBatch(
        batch_code=batch_code,
        driver_id=driver_id,
        dispatcher_id=current_dispatcher.id,
        total_deliveries=len(rows),
        status="active",
    )
    db.add(batch)
    await db.flush()

    # Create deliveries
    deliveries = []
    for i, row in enumerate(rows):
        geo = geo_results[i] if not isinstance(geo_results[i], Exception) else None
        if isinstance(geo_results[i], Exception):
            logger.warning(f"Geocoding failed for address '{addresses[i]}': {geo_results[i]}")

        delivery = Delivery(
            driver_id=driver_id,
            batch_id=batch.id,
            address=row.get("delivery_address", ""),
            order_id=row.get("delivery_id", ""),
            recipient_name=row.get("customer_name", ""),
            customer_email=row.get("customer_email", ""),
            customer_phone=row.get("customer_phone", ""),
            status=DeliveryStatus.en_route,
            package_size=PackageSize.medium,
            weight_kg=1.0,
            lat=geo["lat"] if geo else None,
            lng=geo["lng"] if geo else None,
            queue_position=None,
            city=driver.city,
        )
        db.add(delivery)
        deliveries.append(delivery)

    await db.flush()

    # Run smart queue ordering immediately
    await order_delivery_queue(
        batch_id=batch.id,
        driver_current_lat=driver.lat,
        driver_current_lng=driver.lng,
        db=db,
    )
    await db.commit()

    # Reload deliveries with updated queue_position
    refreshed_result = await db.execute(
        select(Delivery)
        .where(Delivery.batch_id == batch.id)
        .order_by(Delivery.queue_position)
    )
    refreshed_deliveries = refreshed_result.scalars().all()

    first_delivery = refreshed_deliveries[0] if refreshed_deliveries else None

    # Push WebSocket event to driver (includes full deliveries list)
    first_delivery_payload = None
    if first_delivery:
        first_delivery_payload = {
            "id": first_delivery.id,
            "order_id": first_delivery.order_id,
            "address": first_delivery.address,
            "status": first_delivery.status.value,
            "recipient_name": first_delivery.recipient_name,
            "package_size": first_delivery.package_size.value if hasattr(first_delivery.package_size, "value") else str(first_delivery.package_size),
            "weight_kg": first_delivery.weight_kg,
            "queue_position": first_delivery.queue_position,
        }

    all_deliveries_payload = [
        {
            "id": d.id,
            "order_id": d.order_id,
            "address": d.address,
            "status": d.status.value,
            "recipient_name": d.recipient_name,
            "package_size": d.package_size.value if hasattr(d.package_size, "value") else str(d.package_size),
            "weight_kg": d.weight_kg,
            "queue_position": d.queue_position,
            "lat": d.lat,
            "lng": d.lng,
            "customer_phone": d.customer_phone,
        }
        for d in refreshed_deliveries
    ]

    await manager.broadcast("batch_assigned", {
        "driver_id": driver_id,
        "batch_code": batch_code,
        "total_deliveries": len(rows),
        "first_delivery": first_delivery_payload,
        "deliveries": all_deliveries_payload,
    })

    # FCM push to driver
    if driver.fcm_token:
        background_tasks.add_task(
            _send_batch_fcm,
            driver.fcm_token,
            len(rows),
        )

    delivery_out = [DispatcherDeliveryOut.model_validate(d) for d in refreshed_deliveries]

    return BatchUploadResponse(
        batch_code=batch_code,
        driver_id=driver_id,
        driver_name=driver.name,
        total_deliveries=len(rows),
        deliveries=delivery_out,
    )


async def _send_batch_fcm(fcm_token: str, count: int):
    try:
        await fcm_service.send_notification(
            token=fcm_token,
            title="New deliveries assigned",
            body=f"You have {count} deliveries to complete today. Tap to start.",
        )
    except Exception as e:
        logger.warning(f"FCM batch notification failed: {e}")


# ─── Batch Queries ────────────────────────────────────────────────────────────

@router.get("/batch/{batch_code}", response_model=BatchUploadResponse)
async def get_batch(
    batch_code: str,
    db: AsyncSession = Depends(get_db),
    _: Dispatcher = Depends(get_current_dispatcher),
):
    batch_result = await db.execute(
        select(DeliveryBatch)
        .options(selectinload(DeliveryBatch.driver))
        .where(DeliveryBatch.batch_code == batch_code)
    )
    batch = batch_result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    deliveries_result = await db.execute(
        select(Delivery)
        .where(Delivery.batch_id == batch.id)
        .order_by(Delivery.queue_position)
    )
    deliveries = deliveries_result.scalars().all()

    return BatchUploadResponse(
        batch_code=batch.batch_code,
        driver_id=batch.driver_id,
        driver_name=batch.driver.name if batch.driver else "Unknown",
        total_deliveries=batch.total_deliveries,
        deliveries=[DispatcherDeliveryOut.model_validate(d) for d in deliveries],
    )


@router.get("/batches")
async def list_batches(
    db: AsyncSession = Depends(get_db),
    _: Dispatcher = Depends(get_current_dispatcher),
):
    """Return all batches from the last 7 days including per-delivery statuses for the Dispatch Center."""
    window_start = datetime.utcnow() - timedelta(days=7)

    batches_result = await db.execute(
        select(DeliveryBatch)
        .options(selectinload(DeliveryBatch.driver))
        .where(DeliveryBatch.assigned_at >= window_start)
        .order_by(DeliveryBatch.assigned_at.desc())
    )
    batches = batches_result.scalars().all()

    output = []
    for batch in batches:
        del_result = await db.execute(
            select(Delivery)
            .where(Delivery.batch_id == batch.id)
            .order_by(Delivery.queue_position)
        )
        batch_deliveries = del_result.scalars().all()

        delivered_count = sum(1 for d in batch_deliveries if d.status == DeliveryStatus.delivered)
        failed_count = sum(1 for d in batch_deliveries if d.status in (DeliveryStatus.failed, DeliveryStatus.hub_delivered))
        pending_count = len(batch_deliveries) - delivered_count - failed_count

        output.append({
            "id": batch.id,
            "batch_code": batch.batch_code,
            "driver_id": batch.driver_id,
            "driver_name": batch.driver.name if batch.driver else "Unknown",
            "city": batch.driver.city if batch.driver else "Unknown",
            "dispatcher_id": batch.dispatcher_id,
            "assigned_at": batch.assigned_at.isoformat() if batch.assigned_at else None,
            "total_deliveries": batch.total_deliveries,
            "status": batch.status,
            "delivered_count": delivered_count,
            "failed_count": failed_count,
            "pending_count": pending_count,
            "completed": delivered_count,
            "failed": failed_count,
            "deliveries": [
                {
                    "id": d.id,
                    "order_id": d.order_id,
                    "address": d.address,
                    "status": d.status.value if hasattr(d.status, "value") else str(d.status),
                    "recipient_name": d.recipient_name,
                    "queue_position": d.queue_position,
                    "lat": d.lat,
                    "lng": d.lng,
                }
                for d in batch_deliveries
            ],
        })
    return output


# ─── Batch Accept / Reject (driver-facing) ────────────────────────────────────

@router.post("/batch/{batch_code}/accept", response_model=BatchAcceptResponse)
async def accept_batch(
    batch_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Driver accepts a batch — marks batch active and first delivery en_route."""
    batch_result = await db.execute(
        select(DeliveryBatch)
        .options(selectinload(DeliveryBatch.driver))
        .where(DeliveryBatch.batch_code == batch_code)
    )
    batch = batch_result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    batch.status = "accepted"
    db.add(batch)

    # Reload ordered deliveries
    deliveries_result = await db.execute(
        select(Delivery)
        .where(Delivery.batch_id == batch.id)
        .order_by(Delivery.queue_position)
    )
    deliveries = deliveries_result.scalars().all()

    # Mark first delivery as en_route (it likely already is, but be explicit)
    if deliveries:
        first = deliveries[0]
        first.status = DeliveryStatus.en_route
        db.add(first)

    await db.commit()

    return BatchAcceptResponse(
        batch_code=batch_code,
        status="accepted",
        deliveries=[DispatcherDeliveryOut.model_validate(d) for d in deliveries],
    )


@router.post("/batch/{batch_code}/reject")
async def reject_batch(
    batch_code: str,
    body: BatchRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Driver rejects a batch — marks batch rejected and broadcasts WS event."""
    batch_result = await db.execute(
        select(DeliveryBatch)
        .options(selectinload(DeliveryBatch.driver))
        .where(DeliveryBatch.batch_code == batch_code)
    )
    batch = batch_result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    batch.status = "rejected"
    db.add(batch)
    await db.commit()

    driver_name = batch.driver.name if batch.driver else "Unknown"

    await manager.broadcast("batch_rejected", {
        "batch_code": batch_code,
        "driver_name": driver_name,
        "reason": body.reason,
    })

    return {"batch_code": batch_code, "status": "rejected"}


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=DispatcherStatsOut)
async def get_dispatcher_stats(
    city: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: Dispatcher = Depends(get_current_dispatcher),
):
    window_start = datetime.utcnow() - timedelta(days=7)
    active_threshold = datetime.utcnow() - timedelta(hours=24)

    drivers_query = select(Driver)
    if city and city != "All Cities":
        drivers_query = drivers_query.where(Driver.city == city)
    drivers_result = await db.execute(drivers_query)
    all_drivers = drivers_result.scalars().all()
    active_drivers = sum(
        1 for d in all_drivers
        if d.last_ping_at and d.last_ping_at >= active_threshold
    )

    total_query = select(func.count(Delivery.id)).where(Delivery.created_at >= window_start)
    if city and city != "All Cities":
        total_query = total_query.where(Delivery.city == city)
    total_result = await db.execute(total_query)
    total_assigned = total_result.scalar() or 0

    delivered_query = select(func.count(Delivery.id)).where(
        Delivery.created_at >= window_start,
        Delivery.status == DeliveryStatus.delivered,
    )
    if city and city != "All Cities":
        delivered_query = delivered_query.where(Delivery.city == city)
    delivered_result = await db.execute(delivered_query)
    delivered_today = delivered_result.scalar() or 0

    failed_query = select(func.count(Delivery.id)).where(
        Delivery.created_at >= window_start,
        Delivery.status == DeliveryStatus.failed,
    )
    if city and city != "All Cities":
        failed_query = failed_query.where(Delivery.city == city)
    failed_result = await db.execute(failed_query)
    failed_today = failed_result.scalar() or 0

    hub_rerouted_query = select(func.count(HubBroadcast.id)).join(Hub).where(
        HubBroadcast.broadcast_at >= window_start,
        HubBroadcast.accepted_at != None,
    )
    if city and city != "All Cities":
        hub_rerouted_query = hub_rerouted_query.where(Hub.city == city)
    hub_rerouted_result = await db.execute(hub_rerouted_query)
    hub_rerouted = hub_rerouted_result.scalar() or 0

    pending_query = select(func.count(Delivery.id)).where(
        Delivery.created_at >= window_start,
        Delivery.status.in_([DeliveryStatus.en_route, DeliveryStatus.arrived]),
    )
    if city and city != "All Cities":
        pending_query = pending_query.where(Delivery.city == city)
    pending_result = await db.execute(pending_query)
    pending_today = pending_result.scalar() or 0

    active_hubs_query = select(func.count(Hub.id)).where(Hub.availability == True)
    if city and city != "All Cities":
        active_hubs_query = active_hubs_query.where(Hub.city == city)
    active_hubs_result = await db.execute(active_hubs_query)
    active_hubs = active_hubs_result.scalar() or 0

    success_rate = round(delivered_today / total_assigned * 100, 1) if total_assigned > 0 else 0.0

    avg_km_saved_per_reroute = 4.0
    avg_empty_trip_km = 6.0
    idle_time_saved_per_resolved = 0.25 # hours

    km_saved = hub_rerouted * avg_km_saved_per_reroute
    empty_km_avoided = delivered_today * avg_empty_trip_km
    baseline_emissions = total_assigned * avg_empty_trip_km * 0.9

    sus_metrics = calculate_sustainability(
        empty_km_avoided=empty_km_avoided,
        reroute_km_saved=km_saved,
        baseline_emissions=baseline_emissions
    )

    cost_saved = calculate_cost_savings(
        km_saved=km_saved,
        sla_penalty_avoided=hub_rerouted,
        idle_hours_saved=hub_rerouted * idle_time_saved_per_resolved
    )

    return DispatcherStatsOut(
        active_drivers=active_drivers,
        total_assigned_today=total_assigned,
        delivered_today=delivered_today,
        failed_today=failed_today,
        hub_rerouted_today=hub_rerouted,
        pending_today=pending_today,
        success_rate_percent=success_rate,
        co2_saved_kg=sus_metrics["co2_saved_kg"],
        co2_reduced_percent=sus_metrics["co2_reduced_percent"],
        cost_saved=cost_saved,
        active_hubs=active_hubs,
    )


# ─── All Deliveries ───────────────────────────────────────────────────────────

@router.get("/deliveries", response_model=list[DispatcherDeliveryListOut])
async def list_all_deliveries(
    db: AsyncSession = Depends(get_db),
    _: Dispatcher = Depends(get_current_dispatcher),
):
    window_start = datetime.utcnow() - timedelta(days=7)

    deliveries_result = await db.execute(
        select(Delivery)
        .options(
            selectinload(Delivery.driver),
            selectinload(Delivery.batch),
        )
        .where(Delivery.created_at >= window_start)
        .order_by(Delivery.created_at.desc())
    )
    deliveries = deliveries_result.scalars().all()

    output = []
    for d in deliveries:
        output.append(DispatcherDeliveryListOut(
            id=d.id,
            order_id=d.order_id or "",
            address=d.address,
            status=d.status.value if hasattr(d.status, "value") else d.status,
            recipient_name=d.recipient_name,
            driver_name=d.driver.name if d.driver else None,
            driver_id=d.driver_id,
            batch_code=d.batch.batch_code if d.batch else None,
            queue_position=d.queue_position,
            customer_email=d.customer_email,
            customer_phone=d.customer_phone,
            hub_otp_verified=d.hub_otp_verified,
            hub_otp_sent_at=d.hub_otp_sent_at,
            lat=d.lat,
            lng=d.lng,
            city=d.city,
            created_at=d.created_at,
        ))
    return output


# ─── Hub Management ───────────────────────────────────────────────────────────

@router.get("/hubs", response_model=list[DispatcherHubOut])
async def list_hubs(
    db: AsyncSession = Depends(get_db),
    _: Dispatcher = Depends(get_current_dispatcher),
):
    """Return all hubs with operational stats for the dispatcher view."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    hubs_result = await db.execute(select(Hub))
    hubs = hubs_result.scalars().all()

    output = []
    for hub in hubs:
        # Today's accepted drops
        today_drops_result = await db.execute(
            select(func.count(HubBroadcast.id)).where(
                HubBroadcast.hub_id == hub.id,
                HubBroadcast.accepted_at != None,
                HubBroadcast.accepted_at >= today_start,
            )
        )
        today_drops = today_drops_result.scalar() or 0

        # Current packages still held at hub (status = hub_delivered)
        packages_held_result = await db.execute(
            select(func.count(Delivery.id)).where(
                Delivery.hub_id == hub.id,
                Delivery.status == DeliveryStatus.hub_delivered,
            )
        )
        current_packages_held = packages_held_result.scalar() or 0

        output.append(DispatcherHubOut(
            id=hub.id,
            name=hub.name,
            lat=hub.lat,
            lng=hub.lng,
            hub_type=hub.hub_type.value if hasattr(hub.hub_type, "value") else str(hub.hub_type),
            is_active=hub.availability,
            trust_score=hub.trust_score,
            total_drops_all_time=hub.total_accepted_all_time or 0,
            today_drops=today_drops,
            today_earnings_inr=hub.today_earnings or 0.0,
            current_packages_held=current_packages_held,
            owner_phone=hub.owner_phone,
            city=hub.city,
        ))
    return output


@router.post("/hubs", response_model=DispatcherHubOut, status_code=201)
async def register_hub(
    req: RegisterHubRequest,
    db: AsyncSession = Depends(get_db),
    _: Dispatcher = Depends(get_current_dispatcher),
):
    """Register a new micro-hub. Geocodes address if lat/lng not provided."""
    lat = req.lat
    lng = req.lng

    if lat is None or lng is None or (lat == 0.0 and lng == 0.0):
        geo = await geocode_address(req.address)
        if geo:
            lat = geo["lat"]
            lng = geo["lng"]
        else:
            raise HTTPException(
                status_code=400,
                detail="lat/lng not provided and geocoding failed for the given address",
            )

    # Validate hub_type
    try:
        hub_type_enum = HubType(req.hub_type)
    except ValueError:
        hub_type_enum = HubType.kirana

    hub = Hub(
        name=req.name,
        lat=lat,
        lng=lng,
        hub_type=hub_type_enum,
        availability=True,
        owner_phone=req.owner_phone,
        trust_score=85,
        today_earnings=0.0,
        capacity=10,
        current_load=0,
        total_accepted_all_time=0,
    )
    db.add(hub)
    await db.commit()
    await db.refresh(hub)

    return DispatcherHubOut(
        id=hub.id,
        name=hub.name,
        lat=hub.lat,
        lng=hub.lng,
        hub_type=hub.hub_type.value if hasattr(hub.hub_type, "value") else str(hub.hub_type),
        is_active=hub.availability,
        trust_score=hub.trust_score,
        total_drops_all_time=0,
        today_drops=0,
        today_earnings_inr=0.0,
        current_packages_held=0,
        owner_phone=hub.owner_phone,
    )


@router.patch("/hubs/{hub_id}", response_model=DispatcherHubOut)
async def update_hub(
    hub_id: int,
    req: UpdateHubRequest,
    db: AsyncSession = Depends(get_db),
    _: Dispatcher = Depends(get_current_dispatcher),
):
    """Update hub availability, name, or type."""
    hub_result = await db.execute(select(Hub).where(Hub.id == hub_id))
    hub = hub_result.scalar_one_or_none()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")

    if req.is_active is not None:
        hub.availability = req.is_active
    if req.name is not None:
        hub.name = req.name
    if req.hub_type is not None:
        try:
            hub.hub_type = HubType(req.hub_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid hub_type: {req.hub_type}")

    db.add(hub)
    await db.commit()
    await db.refresh(hub)

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_drops_result = await db.execute(
        select(func.count(HubBroadcast.id)).where(
            HubBroadcast.hub_id == hub.id,
            HubBroadcast.accepted_at != None,
            HubBroadcast.accepted_at >= today_start,
        )
    )
    today_drops = today_drops_result.scalar() or 0

    packages_held_result = await db.execute(
        select(func.count(Delivery.id)).where(
            Delivery.hub_id == hub.id,
            Delivery.status == DeliveryStatus.hub_delivered,
        )
    )
    current_packages_held = packages_held_result.scalar() or 0

    return DispatcherHubOut(
        id=hub.id,
        name=hub.name,
        lat=hub.lat,
        lng=hub.lng,
        hub_type=hub.hub_type.value if hasattr(hub.hub_type, "value") else str(hub.hub_type),
        is_active=hub.availability,
        trust_score=hub.trust_score,
        total_drops_all_time=hub.total_accepted_all_time or 0,
        today_drops=today_drops,
        today_earnings_inr=hub.today_earnings or 0.0,
        current_packages_held=current_packages_held,
        owner_phone=hub.owner_phone,
    )


@router.get("/hubs/{hub_id}/history", response_model=list[HubDropHistoryItem])
async def get_hub_history(
    hub_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dispatcher = Depends(get_current_dispatcher),
):
    """Return the last 50 broadcast events for a specific hub."""
    hub_result = await db.execute(select(Hub).where(Hub.id == hub_id))
    hub = hub_result.scalar_one_or_none()
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")

    broadcasts_result = await db.execute(
        select(HubBroadcast)
        .options(selectinload(HubBroadcast.delivery))
        .where(HubBroadcast.hub_id == hub_id)
        .order_by(HubBroadcast.broadcast_at.desc())
        .limit(50)
    )
    broadcasts = broadcasts_result.scalars().all()

    output = []
    for bc in broadcasts:
        delivery = bc.delivery
        if delivery is None:
            continue
        output.append(HubDropHistoryItem(
            delivery_id=delivery.id,
            order_id=delivery.order_id or "",
            address=delivery.address,
            accepted_at=bc.accepted_at,
            pickup_code=bc.pickup_code,
        ))
    return output


@router.delete("/batch/{batch_id}")
async def delete_batch(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    _: Dispatcher = Depends(get_current_dispatcher),
):
    """Delete a batch and all its associated deliveries."""
    # Delete deliveries first
    from sqlalchemy import delete
    await db.execute(delete(Delivery).where(Delivery.batch_id == batch_id))
    
    # Delete the batch itself
    batch_result = await db.execute(select(DeliveryBatch).where(DeliveryBatch.id == batch_id))
    batch = batch_result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
        
    await db.delete(batch)
    await db.commit()
    
    return {"success": True, "message": f"Batch {batch_id} deleted"}

