"""
Final revised seed script with:
1. HubBroadcast entries to trigger "Cost Saved" and "SLA Breaches".
2. Active batches and clean names.
3. Realistic en_route statuses for mobile.
"""
import asyncio
import random
from datetime import datetime, timedelta

from database import init_db, AsyncSessionLocal
from models import (
    Driver, Hub, Delivery, HubBroadcast, DeliveryStatus, PackageSize, HubType,
    User, UserRole, Dispatcher, DeliveryBatch,
)
from auth import hash_password

CITIES = ['Hyderabad', 'Mumbai', 'Chennai', 'Delhi', 'Bengaluru', 'Kolkata']

CITY_DATA = {
    'Hyderabad': {
        'coords': (17.3850, 78.4867),
        'bounds': {'lat': (17.3500, 17.4800), 'lng': (78.3500, 78.5000)},
        'addresses': [
            "Plot 42, Road No.12, Banjara Hills, Hyderabad - 500034",
            "Flat 3B, Vasavi Towers, Kondapur, Hyderabad - 500084",
            "H.No 15, Srinagar Colony, Ameerpet, Hyderabad - 500016",
        ],
        'hubs': ["Banjara Hills Hub", "Madhapur Kirana", "Kondapur Pharmacy"]
    },
    'Mumbai': {
        'coords': (19.0760, 72.8777),
        'bounds': {'lat': (18.9500, 19.2000), 'lng': (72.8000, 72.9000)},
        'addresses': [
            "Flat 202, Pali Hill, Bandra West, Mumbai - 400050",
            "Building 5, Hiranandani Gardens, Powai, Mumbai - 400076",
        ],
        'hubs': ["Bandra West Hub", "Powai Smart Point"]
    },
    'Delhi': {
        'coords': (28.7041, 77.1025),
        'bounds': {'lat': (28.5000, 28.7500), 'lng': (77.0500, 77.2500)},
        'hubs': ["CP Central Hub", "Dwarka Sector 12"]
    },
    'Bengaluru': {
        'coords': (12.9716, 77.5946),
        'bounds': {'lat': (12.9000, 13.0500), 'lng': (77.5000, 77.7000)},
        'hubs': ["Indiranagar Hub", "Whitefield Ops Center"]
    },
    'Chennai': {
        'coords': (13.0827, 80.2707),
        'bounds': {'lat': (12.9500, 13.1500), 'lng': (80.1500, 80.3000)},
        'hubs': ["Anna Nagar Hub", "OMR Tech Relay"]
    },
    'Kolkata': {
        'coords': (22.5726, 88.3639),
        'bounds': {'lat': (22.4500, 22.6500), 'lng': (88.3000, 88.4500)},
        'hubs': ["Salt Lake Sector V", "Park Street Central"]
    }
}

for city in CITIES:
    if 'addresses' not in CITY_DATA[city]:
        CITY_DATA[city]['addresses'] = ["City Center Address 1", "City Center Address 2"]

DRIVER_NAMES = ["Arjun Reddy", "Priya Sharma", "Mohammed Farhan", "Sneha Patel", "Karthik Nair", "Rahul Verma", "Anita Singh", "Vikram Chandra"]

async def seed():
    await init_db()
    async with AsyncSessionLocal() as db:
        from sqlalchemy import text
        for tbl in ["hub_broadcasts", "deliveries", "delivery_batches", "dispatchers", "hubs", "drivers", "users"]:
            await db.execute(text(f"DELETE FROM {tbl}"))
        await db.commit()

        dispatcher = Dispatcher(name="Dispatch Admin", email="dispatcher@neardrop.in", password_hash=hash_password("dispatch123"))
        db.add(dispatcher)
        await db.flush()

        now = datetime.utcnow()
        driver_pw = hash_password("driver123")
        hub_pw = hash_password("hub123")
        user_count = 1

        for city in CITIES:
            data = CITY_DATA[city]
            lat_min, lat_max = data['bounds']['lat']
            lng_min, lng_max = data['bounds']['lng']

            # Seed drivers
            city_drivers = []
            for i in range(4):
                d = Driver(
                    name=random.choice(DRIVER_NAMES), city=city, lat=random.uniform(lat_min, lat_max), lng=random.uniform(lng_min, lng_max),
                    status=DeliveryStatus.en_route, trust_score=random.randint(75, 95), last_ping_at=now - timedelta(minutes=random.randint(1, 30))
                )
                db.add(d)
                city_drivers.append(d)
            await db.flush()

            # Create users
            for idx, d in enumerate(city_drivers):
                db.add(User(phone=f"9{user_count:09d}", hashed_password=driver_pw, role=UserRole.driver, name=d.name, driver_id=d.id))
                user_count += 1

            # Seed hubs
            city_hubs = []
            for hub_name in data['hubs']:
                h = Hub(
                    name=hub_name, owner_name=f"Owner {random.randint(1,100)}", city=city,
                    lat=random.uniform(lat_min, lat_max), lng=random.uniform(lng_min, lng_max),
                    availability=True, trust_score=random.randint(85, 98)
                )
                db.add(h)
                city_hubs.append(h)
            await db.flush()

            # Seed batches and deliveries
            driver = city_drivers[0]
            batch = DeliveryBatch(batch_code=f"BATCH-{city[:3].upper()}-{random.randint(100,999)}", driver_id=driver.id, dispatcher_id=dispatcher.id, status="active", total_deliveries=10)
            db.add(batch)
            await db.flush()

            for i in range(10):
                status = DeliveryStatus.delivered if i < 6 else DeliveryStatus.en_route
                delivery = Delivery(
                    driver_id=driver.id, batch_id=batch.id, status=status, city=city,
                    address=random.choice(data['addresses']), lat=random.uniform(lat_min, lat_max), lng=random.uniform(lng_min, lng_max),
                    order_id=f"ORD-{city[:2]}-{batch.id}-{i}", created_at=now - timedelta(hours=2)
                )
                db.add(delivery)
                await db.flush()

                # ── Seed successful reroutes for Cost Saved ─────────────
                # (1 reroute per city)
                if i == 0:
                    broadcast = HubBroadcast(
                        delivery_id=delivery.id, hub_id=city_hubs[0].id,
                        broadcast_at=now - timedelta(hours=1),
                        accepted_at=now - timedelta(minutes=45)
                    )
                    db.add(broadcast)

        await db.commit()
        print("Final Seed complete: Active reroutes added (Cost Saved should now be > 0).")

if __name__ == "__main__":
    asyncio.run(seed())
