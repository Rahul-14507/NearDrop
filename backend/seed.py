"""
Seed script — generates realistic mock data for Hyderabad.
Run from backend/: python seed.py
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


DRIVERS = [
    {"name": "Arjun Reddy",      "lat": 17.4239, "lng": 78.4738, "status": DeliveryStatus.en_route,  "trust_score": 94, "vehicle": "Royal Enfield",  "phone": "+91 98765 43210"},
    {"name": "Priya Sharma",     "lat": 17.4456, "lng": 78.3647, "status": DeliveryStatus.delivered,  "trust_score": 88, "vehicle": "Activa",          "phone": "+91 98765 43211"},
    {"name": "Mohammed Farhan",  "lat": 17.4123, "lng": 78.4501, "status": DeliveryStatus.failed,     "trust_score": 79, "vehicle": "TVS Jupiter",     "phone": "+91 98765 43212"},
    {"name": "Sneha Patel",      "lat": 17.4385, "lng": 78.3892, "status": DeliveryStatus.arrived,    "trust_score": 96, "vehicle": "Honda Shine",     "phone": "+91 98765 43213"},
    {"name": "Karthik Nair",     "lat": 17.4501, "lng": 78.4012, "status": DeliveryStatus.en_route,  "trust_score": 71, "vehicle": "Bajaj Pulsar",    "phone": "+91 98765 43214"},
]

HUBS = [
    {"name": "NearDrop Hub — Secunderabad", "owner_name": "Ramesh Kumar",     "lat": 17.4520, "lng": 78.4870, "hub_type": HubType.kirana,    "trust_score": 91, "today_earnings": 125.0},
    {"name": "NearDrop Hub — Madhapur",      "owner_name": "Latha Devi",       "lat": 17.4490, "lng": 78.3920, "hub_type": HubType.kirana,    "trust_score": 87, "today_earnings": 75.0},
    {"name": "City Pharmacy - Kondapur",   "owner_name": "Dr. Venkat Rao",   "lat": 17.4602, "lng": 78.3548, "hub_type": HubType.pharmacy,  "trust_score": 95, "today_earnings": 200.0},
    {"name": "Vasavi Apartments Reception","owner_name": "Security: Suresh", "lat": 17.4321, "lng": 78.4123, "hub_type": HubType.apartment, "trust_score": 82, "today_earnings": 50.0},
    {"name": "Madhapur Medicals",          "owner_name": "Srinivas Goud",    "lat": 17.4478, "lng": 78.3921, "hub_type": HubType.pharmacy,  "trust_score": 89, "today_earnings": 150.0},
    {"name": "Hitech City Kirana",         "owner_name": "Anand Sharma",     "lat": 17.4456, "lng": 78.3815, "hub_type": HubType.kirana,    "trust_score": 93, "today_earnings": 225.0},
    {"name": "Prestige Plaza Reception",   "owner_name": "Security: Rakesh", "lat": 17.4189, "lng": 78.4634, "hub_type": HubType.apartment, "trust_score": 85, "today_earnings": 100.0},
    {"name": "Jubilee Hills Mini Mart",    "owner_name": "Pallavi Rao",      "lat": 17.4312, "lng": 78.4089, "hub_type": HubType.kirana,    "trust_score": 90, "today_earnings": 175.0},
    {"name": "Gachibowli Tech Hub",        "owner_name": "Arun Kumar",       "lat": 17.4420, "lng": 78.3640, "hub_type": HubType.kirana,    "trust_score": 92, "today_earnings": 110.0},
    {"name": "Kukatpally Depot",           "owner_name": "Vamshi Krishna",   "lat": 17.4849, "lng": 78.4138, "hub_type": HubType.apartment, "trust_score": 85, "today_earnings": 60.0},
    {"name": "LB Nagar Super Mart",        "owner_name": "Radha Reddy",      "lat": 17.3483, "lng": 78.5481, "hub_type": HubType.kirana,    "trust_score": 88, "today_earnings": 130.0},
    {"name": "Mehdipatnam Medico",         "owner_name": "Aslam Khan",       "lat": 17.3948, "lng": 78.4326, "hub_type": HubType.pharmacy,  "trust_score": 96, "today_earnings": 190.0},
    {"name": "Uppal Crossroads Mart",      "owner_name": "Praveen M",        "lat": 17.4018, "lng": 78.5602, "hub_type": HubType.kirana,    "trust_score": 89, "today_earnings": 140.0},
    {"name": "Begumpet Towers",            "owner_name": "Security: Ramesh", "lat": 17.4447, "lng": 78.4664, "hub_type": HubType.apartment, "trust_score": 81, "today_earnings": 40.0},
    {"name": "Dilsukhnagar Pharma",        "owner_name": "Dr. Sunitha",      "lat": 17.3685, "lng": 78.5316, "hub_type": HubType.pharmacy,  "trust_score": 94, "today_earnings": 210.0},
    {"name": "Attapur Kirana",             "owner_name": "Ali Hassan",       "lat": 17.3601, "lng": 78.4239, "hub_type": HubType.kirana,    "trust_score": 87, "today_earnings": 105.0},
    {"name": "Miyapur Central",            "owner_name": "Karthik Ch",       "lat": 17.4933, "lng": 78.3516, "hub_type": HubType.kirana,    "trust_score": 91, "today_earnings": 165.0},
    {"name": "Tolichowki General Store",   "owner_name": "Imran Syed",       "lat": 17.4065, "lng": 78.4116, "hub_type": HubType.kirana,    "trust_score": 86, "today_earnings": 95.0},
    {"name": "Sanath Nagar Pharmacy",      "owner_name": "Murali Mohan",     "lat": 17.4560, "lng": 78.4439, "hub_type": HubType.pharmacy,  "trust_score": 93, "today_earnings": 180.0},
]

ADDRESSES = [
    "Plot 42, Road No.12, Banjara Hills, Hyderabad - 500034",
    "Flat 3B, Vasavi Towers, Kondapur, Hyderabad - 500084",
    "H.No 15, Srinagar Colony, Ameerpet, Hyderabad - 500016",
    "Shop 7, Jubilee Hills Check Post, Hyderabad - 500033",
    "Plot 88, Madhapur, HITEC City, Hyderabad - 500081",
    "Flat 201, Aditya Heights, Gachibowli, Hyderabad - 500032",
    "H.No 33, Road 5, Banjara Hills, Hyderabad - 500034",
    "Flat 4A, My Home Hub, Hitech City, Hyderabad - 500081",
    "Plot 12, Kavuri Hills, Madhapur, Hyderabad - 500033",
    "Office 301, Cyber Towers, HITEC City, Hyderabad - 500081",
    "Villa 22, Jubilee Hills Phase 2, Hyderabad - 500033",
    "Flat 501, Lotus Pond, Khairatabad, Hyderabad - 500004",
]

RECIPIENT_NAMES = [
    "Rahul Verma", "Anita Singh", "Suresh Babu", "Deepa Krishnan",
    "Vikram Chandra", "Meena Reddy", "Anil Kumar", "Sunita Joshi",
    "Ravi Teja", "Priyanka Das", "Mohan Lal", "Kavya Nair",
]

# Realistic Hyderabad batch delivery data (address, lat, lng, customer details)
BATCH_1_DELIVERIES = [
    ("Flat 12B, Jubilee Hills Phase 2, Road 36, Hyderabad 500033", 17.4239, 78.4063, "Priya Sharma",    "priya.sharma@gmail.com",  "9876543210"),
    ("Plot 55, Banjara Hills, Road 10, Hyderabad 500034",           17.4173, 78.4478, "Ravi Kumar",      "ravi.kumar@gmail.com",    "9876543211"),
    ("H.No 22, Srinagar Colony, Ameerpet, Hyderabad 500016",        17.4317, 78.4488, "Deepa Nair",      "deepa.nair@gmail.com",    "9876543212"),
    ("Flat 301, Vasavi Towers, Kondapur, Hyderabad 500084",         17.4601, 78.3540, "Suresh Babu",     "suresh.b@gmail.com",      "9876543213"),
    ("Plot 88, Kavuri Hills, Madhapur, Hyderabad 500033",           17.4348, 78.3975, "Anita Singh",     "anita.singh@gmail.com",   "9876543214"),
    ("Office 201, Cyber Towers, HITEC City, Hyderabad 500081",      17.4435, 78.3772, "Vikram Reddy",    "vikram.r@gmail.com",      "9876543215"),
]

BATCH_2_DELIVERIES = [
    ("Flat 8A, My Home Hub, Hitech City, Hyderabad 500081",         17.4477, 78.3802, "Mohammed Ali",    "m.ali@gmail.com",         "9876543220"),
    ("H.No 15, Gachibowli Village, Gachibowli, Hyderabad 500032",   17.4400, 78.3489, "Sunita Joshi",    "sunita.j@gmail.com",      "9876543221"),
    ("Plot 12, Manikonda, Hyderabad 500089",                         17.4036, 78.3892, "Kiran Babu",      "kiran.b@gmail.com",       "9876543222"),
    ("Flat 402, Aditya Heights, Gachibowli, Hyderabad 500032",      17.4420, 78.3510, "Meena Reddy",     "meena.r@gmail.com",       "9876543223"),
    ("H.No 7, Tolichowki, Hyderabad 500008",                        17.4054, 78.4232, "Anil Kumar",      "anil.k@gmail.com",        "9876543224"),
    ("Plot 33, Nanakramguda, Hyderabad 500032",                     17.4278, 78.3619, "Pooja Sharma",    "pooja.s@gmail.com",       "9876543225"),
    ("Flat 201, Prestige Towers, Raidurgam, Hyderabad 500032",      17.4310, 78.3706, "Rajesh Verma",    "rajesh.v@gmail.com",      "9876543226"),
    ("H.No 44, Puppalaguda, Hyderabad 500089",                      17.4100, 78.3780, "Kavya Nair",      "kavya.n@gmail.com",       "9876543227"),
]


# ── Specific Incidents from Dispatcher Portal V2 ─────────────────────────────────
DISPATCHER_V2_INCIDENTS = [
    {
        "order_id": "DEL-2048",
        "location": "Banjara Hills, Hyderabad",
        "lat": 17.4102, "lng": 78.4482,
        "status": DeliveryStatus.failed,
        "failure_reason": "Customer not available",
    },
    {
        "order_id": "DEL-2051",
        "location": "Jubilee Hills, Hyderabad",
        "lat": 17.4325, "lng": 78.4071,
        "status": DeliveryStatus.failed,
        "failure_reason": "Wrong address provided",
    },
    {
        "order_id": "DEL-2039",
        "location": "Gachibowli, Hyderabad",
        "lat": 17.4401, "lng": 78.3489,
        "status": DeliveryStatus.delivered,
        "failure_reason": "Package damaged in transit",
    },
    {
        "order_id": "DEL-2062",
        "location": "Kondapur, Hyderabad",
        "lat": 17.4600, "lng": 78.3626,
        "status": DeliveryStatus.failed,
        "failure_reason": "Delivery address locked",
    },
    {
        "order_id": "DEL-2075",
        "location": "Madhapur, Hyderabad",
        "lat": 17.4485, "lng": 78.3908,
        "status": DeliveryStatus.delivered,
        "failure_reason": "Package refused by recipient",
    },
    {
        "order_id": "DEL-2081",
        "location": "Kukatpally, Hyderabad",
        "lat": 17.4849, "lng": 78.4138,
        "status": DeliveryStatus.failed,
        "failure_reason": "Driver vehicle breakdown",
    },
    {
        "order_id": "DEL-2094",
        "location": "Secunderabad, Hyderabad",
        "lat": 17.4399, "lng": 78.4983,
        "status": DeliveryStatus.failed,
        "failure_reason": "Attempted 3 times, no response",
    },
    {
        "order_id": "DEL-2103",
        "location": "LB Nagar, Hyderabad",
        "lat": 17.3483, "lng": 78.5481,
        "status": DeliveryStatus.failed,
        "failure_reason": "Gate locked, no intercom",
    },
]


async def seed():
    await init_db()
    async with AsyncSessionLocal() as db:
        from sqlalchemy import text

        # Clear in dependency order
        await db.execute(text("DELETE FROM hub_broadcasts"))
        await db.execute(text("DELETE FROM deliveries"))
        await db.execute(text("DELETE FROM delivery_batches"))
        await db.execute(text("DELETE FROM dispatchers"))
        await db.execute(text("DELETE FROM hubs"))
        await db.execute(text("DELETE FROM drivers"))
        await db.execute(text("DELETE FROM users"))
        await db.commit()

        # ── Seed drivers ──────────────────────────────────────────────────────
        drivers = []
        now = datetime.utcnow()
        for i, d in enumerate(DRIVERS):
            driver = Driver(**d)
            # First 3 drivers are "active" (pinged in last 5 minutes)
            if i < 3:
                driver.last_ping_at = now - timedelta(minutes=random.randint(1, 4))
            db.add(driver)
            drivers.append(driver)
        await db.flush()

        # ── Seed hubs ─────────────────────────────────────────────────────────
        hubs = []
        for h in HUBS:
            hub = Hub(**h)
            db.add(hub)
            hubs.append(hub)
        await db.flush()

        # ── Seed standalone deliveries (50 spread across today) ───────────────
        base_time = datetime.utcnow().replace(hour=7, minute=0, second=0, microsecond=0)
        statuses = (
            [DeliveryStatus.delivered] * 37 +
            [DeliveryStatus.failed] * 3 +
            [DeliveryStatus.en_route] * 7 +
            [DeliveryStatus.arrived] * 3
        )
        random.shuffle(statuses)

        for i in range(50):
            driver = random.choice(drivers)
            status = statuses[i]
            offset_mins = random.randint(0, 600)
            created = base_time + timedelta(minutes=offset_mins)
            delivered_at = created + timedelta(minutes=random.randint(15, 45)) if status == DeliveryStatus.delivered else None

            lat = round(random.uniform(17.35, 17.48), 6)
            lng = round(random.uniform(78.35, 78.50), 6)

            delivery = Delivery(
                driver_id=driver.id,
                address=random.choice(ADDRESSES),
                status=status,
                package_size=random.choice(list(PackageSize)),
                weight_kg=round(random.uniform(0.2, 10.0), 1),
                created_at=created,
                delivered_at=delivered_at,
                recipient_name=random.choice(RECIPIENT_NAMES),
                order_id=f"ND{10100 + i}",
                lat=lat,
                lng=lng,
            )
            db.add(delivery)

        await db.flush()

        # Guarantee driver 1 has an active en_route delivery
        guaranteed_delivery = Delivery(
            driver_id=1,
            address="Plot 42, Road No.12, Banjara Hills, Hyderabad - 500034",
            status=DeliveryStatus.en_route,
            package_size=PackageSize.medium,
            weight_kg=8.9,
            created_at=datetime.utcnow() - timedelta(minutes=10),
            recipient_name="Anita Singh",
            order_id="ND10006",
        )
        db.add(guaranteed_delivery)

        # Guarantee Hub 1 has an accepted broadcast (to show OTP)
        guaranteed_failed = Delivery(
            driver_id=2,
            address="Shop 7, Jubilee Hills Check Post, Hyderabad - 500033",
            status=DeliveryStatus.failed,
            package_size=PackageSize.small,
            weight_kg=1.2,
            created_at=datetime.utcnow() - timedelta(minutes=30),
            recipient_name="Rahul Verma",
            order_id="ND10007",
        )
        db.add(guaranteed_failed)
        await db.flush()

        broadcast = HubBroadcast(
            delivery_id=guaranteed_failed.id,
            hub_id=1,
            pickup_code="847291",
            broadcast_at=datetime.utcnow() - timedelta(minutes=25),
            accepted_at=datetime.utcnow() - timedelta(minutes=24),
        )
        db.add(broadcast)
        hubs[0].today_earnings += 25.0

        # Broadcasts for all failed standalone deliveries
        failed_result = await db.execute(
            __import__("sqlalchemy", fromlist=["select"]).select(Delivery).where(Delivery.status == DeliveryStatus.failed)
        )
        failed_deliveries = failed_result.scalars().all()
        import string as st
        for fd in failed_deliveries:
            hub = random.choice(hubs)
            code = "".join(random.choices(st.digits, k=6))
            db.add(HubBroadcast(
                delivery_id=fd.id,
                hub_id=hub.id,
                pickup_code=code,
                broadcast_at=fd.created_at + timedelta(minutes=2),
                accepted_at=fd.created_at + timedelta(minutes=5),
            ))
            hub.today_earnings += 25.0

        await db.commit()

        # ── Seed dispatcher ───────────────────────────────────────────────────
        dispatcher = Dispatcher(
            name="Dispatch Admin",
            email="dispatcher@neardrop.in",
            password_hash=hash_password("dispatch123"),
        )
        db.add(dispatcher)
        await db.flush()

        # ── Seed batch 1: assigned to driver 1 (Arjun Reddy), mixed statuses ─
        batch1 = DeliveryBatch(
            batch_code="BATCH-20250331-001",
            driver_id=drivers[0].id,
            dispatcher_id=dispatcher.id,
            total_deliveries=len(BATCH_1_DELIVERIES),
            status="active",
            assigned_at=datetime.utcnow().replace(hour=7, minute=30, second=0, microsecond=0),
        )
        db.add(batch1)
        await db.flush()

        batch1_statuses = [
            DeliveryStatus.delivered,
            DeliveryStatus.delivered,
            DeliveryStatus.hub_delivered,
            DeliveryStatus.en_route,
            DeliveryStatus.en_route,
            DeliveryStatus.en_route,
        ]
        for i, (addr, lat, lng, name, email, phone) in enumerate(BATCH_1_DELIVERIES):
            status = batch1_statuses[i]
            d_at = batch1.assigned_at + timedelta(minutes=30 * i + 25) if status == DeliveryStatus.delivered else None
            db.add(Delivery(
                driver_id=drivers[0].id,
                batch_id=batch1.id,
                address=addr,
                status=status,
                package_size=PackageSize.medium,
                weight_kg=round(random.uniform(0.5, 5.0), 1),
                created_at=batch1.assigned_at + timedelta(minutes=2),
                delivered_at=d_at,
                recipient_name=name,
                customer_email=email,
                customer_phone=phone,
                order_id=f"ND2{100 + i:03d}",
                queue_position=i + 1,
                lat=lat,
                lng=lng,
            ))

        # ── Seed batch 2: assigned to driver 2 (Priya Sharma), mostly pending ─
        batch2 = DeliveryBatch(
            batch_code="BATCH-20250331-002",
            driver_id=drivers[1].id,
            dispatcher_id=dispatcher.id,
            total_deliveries=len(BATCH_2_DELIVERIES),
            status="active",
            assigned_at=datetime.utcnow().replace(hour=9, minute=0, second=0, microsecond=0),
        )
        db.add(batch2)
        await db.flush()

        batch2_statuses = [
            DeliveryStatus.delivered,
            DeliveryStatus.delivered,
            DeliveryStatus.failed,
            DeliveryStatus.en_route,
            DeliveryStatus.en_route,
            DeliveryStatus.en_route,
            DeliveryStatus.en_route,
            DeliveryStatus.en_route,
        ]
        for i, (addr, lat, lng, name, email, phone) in enumerate(BATCH_2_DELIVERIES):
            status = batch2_statuses[i]
            d_at = batch2.assigned_at + timedelta(minutes=20 * i + 18) if status == DeliveryStatus.delivered else None
            db.add(Delivery(
                driver_id=drivers[1].id,
                batch_id=batch2.id,
                address=addr,
                status=status,
                package_size=random.choice(list(PackageSize)),
                weight_kg=round(random.uniform(0.3, 6.0), 1),
                created_at=batch2.assigned_at + timedelta(minutes=2),
                delivered_at=d_at,
                recipient_name=name,
                customer_email=email,
                customer_phone=phone,
                order_id=f"ND3{100 + i:03d}",
                queue_position=i + 1,
                lat=lat,
                lng=lng,
            ))

        await db.commit()

        # ── Seed users ────────────────────────────────────────────────────────
        driver_pw = hash_password("driver123")
        hub_pw = hash_password("hub123")

        seed_users = [
            User(phone="9000000001", hashed_password=driver_pw, role=UserRole.driver,
                 name="Arjun Reddy",     driver_id=drivers[0].id),
            User(phone="9000000002", hashed_password=driver_pw, role=UserRole.driver,
                 name="Priya Sharma",    driver_id=drivers[1].id),
            User(phone="9000000003", hashed_password=driver_pw, role=UserRole.driver,
                 name="Mohammed Farhan", driver_id=drivers[2].id),
            User(phone="9000000004", hashed_password=hub_pw, role=UserRole.hub_owner,
                 name="Ramesh Kumar",   hub_id=hubs[0].id),
            User(phone="9000000005", hashed_password=hub_pw, role=UserRole.hub_owner,
                 name="Latha Devi",     hub_id=hubs[1].id),
            User(phone="9000000006", hashed_password=hub_pw, role=UserRole.hub_owner,
                 name="Dr. Venkat Rao", hub_id=hubs[2].id),
        ]
        for u in seed_users:
            db.add(u)
        await db.commit()

        # ── Seed specific Dispatcher V2 incidents ─────────────────────────────
        for inc_data in DISPATCHER_V2_INCIDENTS:
            driver = random.choice(drivers)
            delivery = Delivery(
                driver_id=driver.id,
                address=inc_data["location"],
                lat=inc_data["lat"],
                lng=inc_data["lng"],
                status=inc_data["status"],
                failure_reason=inc_data["failure_reason"],
                order_id=inc_data["order_id"],
                recipient_name=random.choice(RECIPIENT_NAMES),
                package_size=random.choice(list(PackageSize)),
                weight_kg=round(random.uniform(0.5, 5.0), 1),
                created_at=datetime.utcnow() - timedelta(minutes=random.randint(60, 180)),
            )
            db.add(delivery)
        await db.commit()

        print(
            "Seed complete: 5 drivers, 8 hubs, 50 standalone deliveries, "
            "1 dispatcher, 2 batches (6+8 deliveries), 6 users, "
            f"{len(DISPATCHER_V2_INCIDENTS)} V2 incidents"
        )


if __name__ == "__main__":
    asyncio.run(seed())
