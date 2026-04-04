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
    city: Optional[str] = None

    class Config:
        from_attributes = True


class DriverScore(BaseModel):
    driver_id: int
    name: str
    trust_score: int
    recent_deliveries: List[dict]


class DriverLocationUpdate(BaseModel):
    lat: float
    lng: float


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
    city: Optional[str] = None
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
    queue_position: Optional[int] = None
    batch_id: Optional[int] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    hub_otp_verified: Optional[bool] = None
    hub_otp_sent_at: Optional[datetime] = None
    city: Optional[str] = None

    class Config:
        from_attributes = True


class HubBroadcastOut(BaseModel):
    id: int
    delivery: DeliveryOut
    distance_m: float
    reward: float

    class Config:
        from_attributes = True


class StoredPackageOut(BaseModel):
    delivery_id: int
    order_id: str
    address: str
    recipient_name: Optional[str] = None
    hub_otp_verified: bool
    hub_otp_sent_at: Optional[datetime] = None

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


class HubConfirmPickupRequest(BaseModel):
    delivery_id: int


# --- OTP ---
class OTPVerifyRequest(BaseModel):
    otp: str


class OTPVerifyResponse(BaseModel):
    verified: bool
    customer_name: Optional[str] = None
    package_id: Optional[str] = None
    message: Optional[str] = None


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
    trend: str   # "up" | "down" | "stable"


# --- Auth ---
class LoginRequest(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    password: str
    role: str   # "driver" | "hub_owner" | "dispatcher"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    name: str
    dispatcher_id: Optional[int] = None


class UserProfile(BaseModel):
    user_id: int
    role: str
    name: str
    phone: str


class FCMTokenRequest(BaseModel):
    driver_id: int
    fcm_token: str


class DeliveryCompleteResponse(BaseModel):
    success: bool
    delivery_id: int


# --- Dispatcher ---
class DispatcherDriverOut(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    is_active: bool
    current_lat: float
    current_lng: float
    today_assigned: int
    today_completed: int
    today_failed: int
    trust_score: int
    band: Optional[str] = None
    city: Optional[str] = None


class DispatcherStatsOut(BaseModel):
    active_drivers: int
    total_assigned_today: int
    delivered_today: int
    failed_today: int
    hub_rerouted_today: int
    pending_today: int
    success_rate_percent: float
    co2_saved_kg: float
    co2_reduced_percent: float
    cost_saved: float
    active_hubs: int


class DispatcherDeliveryOut(BaseModel):
    id: int
    order_id: str
    address: str
    status: str
    recipient_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    package_size: str
    weight_kg: float
    queue_position: Optional[int] = None
    created_at: datetime
    hub_otp_verified: Optional[bool] = None
    hub_otp_sent_at: Optional[datetime] = None
    city: Optional[str] = None

    class Config:
        from_attributes = True


class DispatcherBatchOut(BaseModel):
    id: int
    batch_code: str
    driver_id: int
    driver_name: str
    dispatcher_id: int
    assigned_at: datetime
    total_deliveries: int
    status: str
    delivered_count: int
    failed_count: int
    pending_count: int


class BatchUploadResponse(BaseModel):
    batch_code: str
    driver_id: int
    driver_name: str
    total_deliveries: int
    deliveries: List[DispatcherDeliveryOut]


class DispatcherDeliveryListOut(BaseModel):
    id: int
    order_id: str
    address: str
    status: str
    recipient_name: Optional[str] = None
    driver_name: Optional[str] = None
    driver_id: Optional[int] = None
    batch_code: Optional[str] = None
    queue_position: Optional[int] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    hub_otp_verified: Optional[bool] = None
    hub_otp_sent_at: Optional[datetime] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    city: Optional[str] = None
    created_at: datetime


# --- Dispatcher Hub Management ---

class DispatcherHubOut(BaseModel):
    id: int
    name: str
    lat: float
    lng: float
    hub_type: str
    is_active: bool
    trust_score: int
    total_drops_all_time: int
    today_drops: int
    today_earnings_inr: float
    current_packages_held: int
    owner_phone: Optional[str] = None
    city: Optional[str] = None

    class Config:
        from_attributes = True


class RegisterHubRequest(BaseModel):
    name: str
    address: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    hub_type: str
    owner_phone: Optional[str] = None


class UpdateHubRequest(BaseModel):
    is_active: Optional[bool] = None
    name: Optional[str] = None
    hub_type: Optional[str] = None


class HubDropHistoryItem(BaseModel):
    delivery_id: int
    order_id: str
    address: str
    accepted_at: Optional[datetime] = None
    pickup_code: Optional[str] = None


class BatchAcceptResponse(BaseModel):
    batch_code: str
    status: str
    deliveries: List[DispatcherDeliveryOut]


class BatchRejectRequest(BaseModel):
    reason: str
