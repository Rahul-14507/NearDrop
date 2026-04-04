from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey,
    Boolean, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
import enum

from database import Base


class UserRole(str, enum.Enum):
    driver = "driver"
    hub_owner = "hub_owner"


class DeliveryStatus(str, enum.Enum):
    en_route = "en_route"
    arrived = "arrived"
    delivered = "delivered"
    failed = "failed"
    hub_delivered = "hub_delivered"   # driver physically dropped package at hub


class PackageSize(str, enum.Enum):
    small = "small"
    medium = "medium"
    large = "large"


class HubType(str, enum.Enum):
    kirana = "kirana"
    pharmacy = "pharmacy"
    apartment = "apartment"


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    status = Column(SAEnum(DeliveryStatus), default=DeliveryStatus.en_route)
    trust_score = Column(Integer, default=80)
    phone = Column(String(20))
    vehicle = Column(String(50))
    fcm_token = Column(String(255), nullable=True)
    last_ping_at = Column(DateTime, nullable=True)
    acs_user_id = Column(String(255), nullable=True)
    city = Column(String(50), nullable=True)

    deliveries = relationship("Delivery", back_populates="driver")


class Hub(Base):
    __tablename__ = "hubs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    owner_name = Column(String(100))
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    hub_type = Column(SAEnum(HubType), default=HubType.kirana)
    availability = Column(Boolean, default=True)
    trust_score = Column(Integer, default=85)
    today_earnings = Column(Float, default=0.0)
    capacity = Column(Integer, default=10)
    current_load = Column(Integer, default=0)
    owner_phone = Column(String(20), nullable=True)
    city = Column(String(50), nullable=True)
    total_accepted_all_time = Column(Integer, default=0)

    broadcasts = relationship("HubBroadcast", back_populates="hub")


class Dispatcher(Base):
    __tablename__ = "dispatchers"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    batches = relationship("DeliveryBatch", back_populates="dispatcher")


class DeliveryBatch(Base):
    __tablename__ = "delivery_batches"

    id = Column(Integer, primary_key=True)
    batch_code = Column(String(30), unique=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"))
    dispatcher_id = Column(Integer, ForeignKey("dispatchers.id"))
    assigned_at = Column(DateTime, default=datetime.utcnow)
    total_deliveries = Column(Integer)
    status = Column(String(20), default="active")   # active | completed

    driver = relationship("Driver")
    dispatcher = relationship("Dispatcher", back_populates="batches")
    deliveries = relationship("Delivery", back_populates="batch")


class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"))
    hub_id = Column(Integer, ForeignKey("hubs.id"), nullable=True)
    batch_id = Column(Integer, ForeignKey("delivery_batches.id"), nullable=True)
    address = Column(Text, nullable=False)
    status = Column(SAEnum(DeliveryStatus), default=DeliveryStatus.en_route)
    package_size = Column(SAEnum(PackageSize), default=PackageSize.medium)
    weight_kg = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    delivered_at = Column(DateTime, nullable=True)
    recipient_name = Column(String(100))
    order_id = Column(String(20), unique=True)
    failure_reason = Column(Text, nullable=True)

    # Geocoded coordinates for the delivery address
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)

    # Customer contact info (populated via CSV batch upload)
    customer_email = Column(String(255), nullable=True)
    customer_phone = Column(String(30), nullable=True)

    # Queue ordering within the batch
    queue_position = Column(Integer, nullable=True)

    # OTP for customer pickup from hub
    hub_otp = Column(String(6), nullable=True)
    hub_otp_verified = Column(Boolean, default=False)
    hub_otp_sent_at = Column(DateTime, nullable=True)
    city = Column(String(50), nullable=True)

    driver = relationship("Driver", back_populates="deliveries")
    hub = relationship("Hub")
    batch = relationship("DeliveryBatch", back_populates="deliveries")
    broadcast = relationship("HubBroadcast", back_populates="delivery", uselist=False)


class HubBroadcast(Base):
    __tablename__ = "hub_broadcasts"

    id = Column(Integer, primary_key=True, index=True)
    delivery_id = Column(Integer, ForeignKey("deliveries.id"))
    hub_id = Column(Integer, ForeignKey("hubs.id"), nullable=True)
    pickup_code = Column(String(6), nullable=True)
    broadcast_at = Column(DateTime, default=datetime.utcnow)
    accepted_at = Column(DateTime, nullable=True)
    declined = Column(Boolean, default=False)

    delivery = relationship("Delivery", back_populates="broadcast")
    hub = relationship("Hub", back_populates="broadcasts")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(20), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), nullable=False)
    name = Column(String(100), nullable=False)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    hub_id = Column(Integer, ForeignKey("hubs.id"), nullable=True)
