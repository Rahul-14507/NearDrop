from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


# --- Driver ---
class DriverBase(BaseModel):
    name: str
    lat: float
    lng: float
    status: str
    trust_score: int


class DriverOut(DriverBase):
    id: int
    vehicle: Optional[str] = None

    class Config:
        from_attributes = True


class DriverScore(BaseModel):
    driver_id: int
    name: str
    trust_score: int
    recent_deliveries: List[dict]


# --- Hub ---
class HubOut(BaseModel):
    id: int
    name: str
    owner_name: Optional[str] = None
    lat: float
    lng: float
    hub_type: str
    availability: bool
    trust_score: int
    today_earnings: float
    distance_m: Optional[float] = None
    eta_minutes: Optional[int] = None

    class Config:
        from_attributes = True


class HubStats(BaseModel):
    hub_id: int
    name: str
    today_earnings: float
    accepted_count: int
    trust_score: int


# --- Delivery ---
class DeliveryOut(BaseModel):
    id: int
    order_id: str
    address: str
    status: str
    recipient_name: Optional[str]
    package_size: str
    weight_kg: float
    created_at: datetime
    pickup_code: Optional[str] = None

    class Config:
        from_attributes = True


class HubBroadcastOut(BaseModel):
    id: int
    delivery: DeliveryOut
    distance_m: float
    reward: float

    class Config:
        from_attributes = True
class DeliveryFailRequest(BaseModel):
    delivery_id: int
    driver_lat: float
    driver_lng: float


class DeliveryFailResponse(BaseModel):
    success: bool
    delivery_id: int
    nearby_hubs: List[HubOut]


class HubAcceptRequest(BaseModel):
    broadcast_id: int
    hub_id: int


class HubAcceptResponse(BaseModel):
    success: bool
    pickup_code: str
    hub_name: str
    delivery_id: int


# --- Dashboard ---
class DashboardStats(BaseModel):
    total_deliveries: int
    first_attempt_success_rate: float
    hub_reroutes: int
    co2_saved_kg: float
    active_drivers: int


class FleetDriver(BaseModel):
    id: int
    name: str
    lat: float
    lng: float
    status: str
    trust_score: int
    current_delivery: Optional[str] = None


class HourlyMetric(BaseModel):
    hour: int
    deliveries: int
    failures: int


class LeaderboardEntry(BaseModel):
    rank: int
    driver_id: int
    name: str
    deliveries_completed: int
    trust_score: int
    trend: str  # "up" | "down" | "stable"
