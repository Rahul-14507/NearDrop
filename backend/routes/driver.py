from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from auth import get_current_user
from database import get_db
from models import Driver, Delivery, DeliveryStatus, User
from schemas import DriverScore, DeliveryOut, FCMTokenRequest

router = APIRouter(prefix="/driver", tags=["driver"])


@router.get("/{driver_id}/score", response_model=DriverScore)
async def get_driver_score(driver_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Driver).where(Driver.id == driver_id))
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    deliveries_result = await db.execute(
        select(Delivery)
        .where(Delivery.driver_id == driver_id)
        .order_by(Delivery.created_at.desc())
        .limit(10)
    )
    recent = deliveries_result.scalars().all()

    history = [
        {
            "id": d.id,
            "order_id": d.order_id,
            "address": d.address,
            "status": d.status.value if hasattr(d.status, "value") else d.status,
            "package_size": d.package_size.value if hasattr(d.package_size, "value") else d.package_size,
            "created_at": d.created_at.isoformat(),
        }
        for d in recent
    ]

    return DriverScore(
        driver_id=driver.id,
        name=driver.name,
        trust_score=driver.trust_score,
        recent_deliveries=history,
    )


@router.get("/{driver_id}/active_delivery", response_model=Optional[DeliveryOut])
async def get_active_delivery(driver_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Delivery)
        .where(
            Delivery.driver_id == driver_id,
            Delivery.status.in_([DeliveryStatus.en_route, DeliveryStatus.arrived, DeliveryStatus.failed])
        )
        .order_by(Delivery.created_at.desc())
        .limit(1)
    )
    delivery = result.scalar_one_or_none()
    return delivery


@router.post("/fcm-token")
async def register_fcm_token(
    req: FCMTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Driver).where(Driver.id == req.driver_id))
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    driver.fcm_token = req.fcm_token
    await db.commit()
    return {"success": True}
