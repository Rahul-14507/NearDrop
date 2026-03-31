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

from auth import get_current_dispatcher
from database import get_db
from models import (
    Delivery, DeliveryBatch, DeliveryStatus, Dispatcher, Driver,
    HubBroadcast, PackageSize,
)
from schemas import (
    BatchUploadResponse, DispatcherBatchOut, DispatcherDeliveryListOut,
    DispatcherDeliveryOut, DispatcherDriverOut, DispatcherStatsOut,
)
from services.azure_maps import geocode_address
from services.queue_engine import order_delivery_queue
from websocket_manager import manager
from services import fcm as fcm_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dispatcher", tags=["dispatcher"])


# ─── Driver Management ────────────────────────────────────────────────────────

@router.get("/drivers", response_model=list[DispatcherDriverOut])
async def list_drivers(
    db: AsyncSession = Depends(get_db),
    _: Dispatcher = Depends(get_current_dispatcher),
):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    active_threshold = datetime.utcnow() - timedelta(minutes=5)

    result = await db.execute(select(Driver))
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
                Delivery.created_at >= today_start,
            )
        )
        today_assigned = assigned_result.scalar() or 0

        completed_result = await db.execute(
            select(func.count(Delivery.id)).where(
                Delivery.driver_id == driver.id,
                Delivery.created_at >= today_start,
                Delivery.status == DeliveryStatus.delivered,
            )
        )
        today_completed = completed_result.scalar() or 0

        failed_result = await db.execute(
            select(func.count(Delivery.id)).where(
                Delivery.driver_id == driver.id,
                Delivery.created_at >= today_start,
                Delivery.status == DeliveryStatus.failed,
            )
        )
        today_failed = failed_result.scalar() or 0

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
            trust_score=driver.trust_score,
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

    # Push WebSocket event to driver
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

    await manager.broadcast("batch_assigned", {
        "driver_id": driver_id,
        "batch_code": batch_code,
        "total_deliveries": len(rows),
        "first_delivery": first_delivery_payload,
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


@router.get("/batches", response_model=list[DispatcherBatchOut])
async def list_batches(
    db: AsyncSession = Depends(get_db),
    _: Dispatcher = Depends(get_current_dispatcher),
):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    batches_result = await db.execute(
        select(DeliveryBatch)
        .options(selectinload(DeliveryBatch.driver))
        .where(DeliveryBatch.assigned_at >= today_start)
        .order_by(DeliveryBatch.assigned_at.desc())
    )
    batches = batches_result.scalars().all()

    output = []
    for batch in batches:
        del_result = await db.execute(
            select(Delivery).where(Delivery.batch_id == batch.id)
        )
        batch_deliveries = del_result.scalars().all()

        delivered_count = sum(1 for d in batch_deliveries if d.status == DeliveryStatus.delivered)
        failed_count = sum(1 for d in batch_deliveries if d.status == DeliveryStatus.failed)
        pending_count = sum(1 for d in batch_deliveries if d.status in (DeliveryStatus.en_route, DeliveryStatus.arrived))

        output.append(DispatcherBatchOut(
            id=batch.id,
            batch_code=batch.batch_code,
            driver_id=batch.driver_id,
            driver_name=batch.driver.name if batch.driver else "Unknown",
            dispatcher_id=batch.dispatcher_id,
            assigned_at=batch.assigned_at,
            total_deliveries=batch.total_deliveries,
            status=batch.status,
            delivered_count=delivered_count,
            failed_count=failed_count,
            pending_count=pending_count,
        ))
    return output


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=DispatcherStatsOut)
async def get_dispatcher_stats(
    db: AsyncSession = Depends(get_db),
    _: Dispatcher = Depends(get_current_dispatcher),
):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    active_threshold = datetime.utcnow() - timedelta(minutes=5)

    drivers_result = await db.execute(select(Driver))
    all_drivers = drivers_result.scalars().all()
    active_drivers = sum(
        1 for d in all_drivers
        if d.last_ping_at and d.last_ping_at >= active_threshold
    )

    total_result = await db.execute(
        select(func.count(Delivery.id)).where(Delivery.created_at >= today_start)
    )
    total_assigned = total_result.scalar() or 0

    delivered_result = await db.execute(
        select(func.count(Delivery.id)).where(
            Delivery.created_at >= today_start,
            Delivery.status == DeliveryStatus.delivered,
        )
    )
    delivered_today = delivered_result.scalar() or 0

    failed_result = await db.execute(
        select(func.count(Delivery.id)).where(
            Delivery.created_at >= today_start,
            Delivery.status == DeliveryStatus.failed,
        )
    )
    failed_today = failed_result.scalar() or 0

    hub_rerouted_result = await db.execute(
        select(func.count(HubBroadcast.id)).where(
            HubBroadcast.broadcast_at >= today_start,
            HubBroadcast.accepted_at != None,
        )
    )
    hub_rerouted = hub_rerouted_result.scalar() or 0

    pending_result = await db.execute(
        select(func.count(Delivery.id)).where(
            Delivery.created_at >= today_start,
            Delivery.status.in_([DeliveryStatus.en_route, DeliveryStatus.arrived]),
        )
    )
    pending_today = pending_result.scalar() or 0

    success_rate = round(delivered_today / total_assigned * 100, 1) if total_assigned > 0 else 0.0
    co2_saved = round(hub_rerouted * 0.8, 2)

    return DispatcherStatsOut(
        active_drivers=active_drivers,
        total_assigned_today=total_assigned,
        delivered_today=delivered_today,
        failed_today=failed_today,
        hub_rerouted_today=hub_rerouted,
        pending_today=pending_today,
        success_rate_percent=success_rate,
        co2_saved_kg=co2_saved,
    )


# ─── All Deliveries ───────────────────────────────────────────────────────────

@router.get("/deliveries", response_model=list[DispatcherDeliveryListOut])
async def list_all_deliveries(
    db: AsyncSession = Depends(get_db),
    _: Dispatcher = Depends(get_current_dispatcher),
):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    deliveries_result = await db.execute(
        select(Delivery)
        .options(
            selectinload(Delivery.driver),
            selectinload(Delivery.batch),
        )
        .where(Delivery.created_at >= today_start)
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
            created_at=d.created_at,
        ))
    return output
