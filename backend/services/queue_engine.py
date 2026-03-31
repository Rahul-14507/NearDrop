from __future__ import annotations

import math
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models import Delivery, DeliveryStatus

logger = logging.getLogger(__name__)


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def order_delivery_queue(
    batch_id: int,
    driver_current_lat: float,
    driver_current_lng: float,
    db: AsyncSession,
) -> None:
    """
    Order deliveries in a batch using nearest-neighbor greedy algorithm.

    Algorithm:
    1. Start from driver's current GPS position (or centroid if unavailable).
    2. Find the unvisited delivery with the minimum Haversine distance from current point.
    3. Mark it as next in queue, move current point to that delivery's location.
    4. Repeat until all deliveries are ordered.
    5. Update queue_position on each Delivery record (1-indexed).
    6. Set first delivery status to en_route.
    """
    result = await db.execute(
        select(Delivery).where(Delivery.batch_id == batch_id)
    )
    all_deliveries = list(result.scalars().all())

    if not all_deliveries:
        return

    deliveries_with_loc = [d for d in all_deliveries if d.lat is not None and d.lng is not None]
    deliveries_no_loc = [d for d in all_deliveries if d.lat is None or d.lng is None]

    if not deliveries_with_loc:
        # No geocoded locations — assign sequential positions as-is
        for i, d in enumerate(all_deliveries):
            d.queue_position = i + 1
        all_deliveries[0].status = DeliveryStatus.en_route
        logger.info(f"Batch {batch_id}: no geocoded locations, sequential ordering applied")
        return

    # Determine starting point
    start_lat = driver_current_lat
    start_lng = driver_current_lng

    if start_lat == 0.0 and start_lng == 0.0:
        # Driver location not available — use centroid of all geocoded deliveries
        start_lat = sum(d.lat for d in deliveries_with_loc) / len(deliveries_with_loc)
        start_lng = sum(d.lng for d in deliveries_with_loc) / len(deliveries_with_loc)
        logger.info(f"Batch {batch_id}: driver location unavailable, using centroid ({start_lat:.4f}, {start_lng:.4f})")

    # Nearest-neighbor greedy traversal
    unvisited = list(deliveries_with_loc)
    ordered: list[Delivery] = []
    current_lat, current_lng = start_lat, start_lng

    while unvisited:
        nearest = min(
            unvisited,
            key=lambda d: haversine(current_lat, current_lng, d.lat, d.lng),  # type: ignore[arg-type]
        )
        ordered.append(nearest)
        current_lat, current_lng = nearest.lat, nearest.lng  # type: ignore[assignment]
        unvisited.remove(nearest)

    # Append deliveries without geocoded locations at the end
    ordered.extend(deliveries_no_loc)

    # Assign positions and activate the first delivery
    for i, delivery in enumerate(ordered):
        delivery.queue_position = i + 1

    ordered[0].status = DeliveryStatus.en_route

    logger.info(
        f"Batch {batch_id}: ordered {len(ordered)} deliveries; "
        f"first stop: {ordered[0].address}"
    )
