"""Seed product reference data, with optional local demo data for development."""
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from . import models
from .auth import hash_password
from .config import settings
from .database import SessionLocal, engine


STATES = [
    ("Baden-Württemberg", "BW", "Stuttgart"),
    ("Bayern", "BY", "München"),
    ("Berlin", "BE", "Berlin"),
    ("Brandenburg", "BB", "Potsdam"),
    ("Bremen", "HB", "Bremen"),
    ("Hamburg", "HH", "Hamburg"),
    ("Hessen", "HE", "Wiesbaden"),
    ("Mecklenburg-Vorpommern", "MV", "Schwerin"),
    ("Niedersachsen", "NI", "Hannover"),
    ("Nordrhein-Westfalen", "NW", "Düsseldorf"),
    ("Rheinland-Pfalz", "RP", "Mainz"),
    ("Saarland", "SL", "Saarbrücken"),
    ("Sachsen", "SN", "Dresden"),
    ("Sachsen-Anhalt", "ST", "Magdeburg"),
    ("Schleswig-Holstein", "SH", "Kiel"),
    ("Thüringen", "TH", "Erfurt"),
]


CITIES = [
    ("Berlin", "BE", 52.5200, 13.4050, 3645000, True, False),
    ("Hamburg", "HH", 53.5511, 9.9937, 1841000, True, False),
    ("Bremen", "HB", 53.0793, 8.8017, 569000, False, True),
    ("München", "BY", 48.1351, 11.5820, 1472000, True, False),
    ("Nürnberg", "BY", 49.4521, 11.0767, 518000, False, True),
    ("Augsburg", "BY", 48.3717, 10.8983, 296000, False, False),
    ("Frankfurt am Main", "HE", 50.1109, 8.6821, 753000, True, False),
    ("Wiesbaden", "HE", 50.0782, 8.2398, 278000, False, True),
    ("Kassel", "HE", 51.3127, 9.4797, 201000, False, False),
    ("Köln", "NW", 50.9333, 6.9500, 1084000, True, False),
    ("Düsseldorf", "NW", 51.2217, 6.7762, 621000, False, True),
    ("Dortmund", "NW", 51.5153, 7.4597, 588000, False, True),
    ("Essen", "NW", 51.4556, 7.0116, 583000, False, False),
    ("Bonn", "NW", 50.7374, 7.0982, 329000, False, False),
    ("Stuttgart", "BW", 48.7758, 9.1829, 634000, False, True),
    ("Freiburg", "BW", 47.9990, 7.8421, 230000, False, True),
    ("Heidelberg", "BW", 49.4094, 8.6942, 161000, False, False),
    ("Hannover", "NI", 52.3759, 9.7320, 535000, False, True),
    ("Braunschweig", "NI", 52.2689, 10.5268, 248000, False, False),
    ("Dresden", "SN", 51.0504, 13.7373, 554000, False, True),
    ("Leipzig", "SN", 51.3397, 12.3731, 601000, False, True),
    ("Chemnitz", "SN", 50.8278, 12.9214, 247000, False, False),
    ("Mainz", "RP", 49.9929, 8.2473, 218000, False, True),
    ("Koblenz", "RP", 50.3533, 7.5787, 114000, False, False),
    ("Kiel", "SH", 54.3233, 10.1394, 247000, False, True),
    ("Lübeck", "SH", 53.8655, 10.6866, 217000, False, False),
    ("Erfurt", "TH", 50.9847, 11.0299, 214000, False, False),
    ("Jena", "TH", 50.9272, 11.5861, 111000, False, False),
    ("Magdeburg", "ST", 52.1205, 11.6276, 236000, False, False),
    ("Halle", "ST", 51.4825, 11.9706, 238000, False, False),
    ("Rostock", "MV", 54.0887, 12.1401, 209000, False, False),
    ("Schwerin", "MV", 53.6288, 11.4148, 95000, False, False),
    ("Saarbrücken", "SL", 49.2354, 6.9969, 180000, False, False),
    ("Potsdam", "BB", 52.3906, 13.0645, 183000, False, False),
    ("Cottbus", "BB", 51.7563, 14.3329, 99000, False, False),
]


EMERGENCY_SERVICES = [
    ("Police", "110", "German national police emergency. Call for crime in progress, accidents, or threats to safety.", "national", None, "police", True, "German, English"),
    ("Fire & Ambulance", "112", "Fire brigade and ambulance. Also the European emergency number.", "national", None, "fire", True, "German, English"),
    ("Telefonseelsorge", "0800 111 0 111", "Free 24/7 mental health crisis line. Anonymous.", "national", None, "mental_health", True, "German"),
    ("Telefonseelsorge Alternative", "0800 111 0 222", "Alternative 24/7 mental health and emotional support line.", "national", None, "mental_health", True, "German"),
    ("Kenyan Embassy Berlin", "+49 30 259 2660", "Emergency consular assistance for Kenyan nationals.", "national", None, "embassy", False, "English, Swahili, German"),
    ("UNHCR Germany", "+49 30 202 202 0", "Support for asylum seekers and refugees.", "national", None, "immigrant_support", False, "German, English, French"),
    ("Caritas Refugee Advice", "0800 000 4440", "Advice on asylum, immigration, and social support.", "national", None, "immigrant_support", False, "German, Arabic, English"),
    ("Giftnotruf Berlin", "030 19240", "Poison control for Berlin and surrounding eastern states.", "state", "BE", "poison", True, "German"),
    ("Giftnotruf Berlin (Brandenburg)", "030 19240", "Poison control for Brandenburg.", "state", "BB", "poison", True, "German"),
    ("Giftnotruf Berlin (MV)", "030 19240", "Poison control for Mecklenburg-Vorpommern.", "state", "MV", "poison", True, "German"),
    ("Giftnotruf Berlin (Sachsen)", "030 19240", "Poison control for Sachsen.", "state", "SN", "poison", True, "German"),
    ("Giftnotruf Berlin (Sachsen-Anhalt)", "030 19240", "Poison control for Sachsen-Anhalt.", "state", "ST", "poison", True, "German"),
    ("Giftnotruf Berlin (Thüringen)", "030 19240", "Poison control for Thüringen.", "state", "TH", "poison", True, "German"),
    ("Vergiftungs-Informations-Zentrale Bonn", "0228 19240", "Poison control for Nordrhein-Westfalen.", "state", "NW", "poison", True, "German"),
    ("Giftinformationszentrum Nord", "0551 19240", "Poison control for Niedersachsen, Hamburg, Schleswig-Holstein and Bremen.", "state", "NI", "poison", True, "German"),
    ("Giftinformationszentrum Nord (Hamburg)", "0551 19240", "Poison control for Hamburg.", "state", "HH", "poison", True, "German"),
    ("Giftinformationszentrum Nord (SH)", "0551 19240", "Poison control for Schleswig-Holstein.", "state", "SH", "poison", True, "German"),
    ("Giftinformationszentrum Nord (Bremen)", "0551 19240", "Poison control for Bremen.", "state", "HB", "poison", True, "German"),
    ("Giftinformationszentrum Mainz", "06131 19240", "Poison control for Rheinland-Pfalz.", "state", "RP", "poison", True, "German"),
    ("Giftinformationszentrum Mainz (Saarland)", "06131 19240", "Poison control for Saarland.", "state", "SL", "poison", True, "German"),
    ("Vergiftungs-Informations-Zentrale Freiburg", "0761 19240", "Poison control for Baden-Württemberg.", "state", "BW", "poison", True, "German"),
    ("Giftnotruf München", "089 19240", "Poison control for Bayern.", "state", "BY", "poison", True, "German"),
    ("Giftnotruf München (Hessen)", "089 19240", "Poison control for Hessen.", "state", "HE", "poison", True, "German"),
]


def ensure_schema_compatibility() -> None:
    inspector = inspect(engine)
    if "listings" not in inspector.get_table_names():
        return
    columns = {c["name"] for c in inspector.get_columns("listings")}
    statements = []
    dialect = engine.dialect.name
    if "state_id" not in columns:
        statements.append("ALTER TABLE listings ADD COLUMN state_id INTEGER")
    if "city_id" not in columns:
        statements.append("ALTER TABLE listings ADD COLUMN city_id INTEGER")
    with engine.begin() as conn:
        for statement in statements:
            if dialect == "postgresql":
                statement = statement.replace(" INTEGER", " INTEGER")
            conn.execute(text(statement))


def seed_listings(db: Session) -> None:
    if db.query(models.Listing).count() > 0:
        backfill_listing_cities(db)
        return
    berlin = get_city(db, "Berlin", "BE")
    db.add_all([
        models.Listing(
            title="Cozy Room in Neukölln",
            price=550,
            district="Neukölln",
            address="Karl-Marx-Straße, Neukölln",
            transit_info="5 min to U8 Boddinstraße",
            description="Bright and cozy room in a friendly apartment. Perfect for students and young professionals arriving in Berlin. Anmeldung-friendly host.",
            theme="sun",
            rating="4.8 ★",
            is_top_match=True,
            state_id=berlin.state_id if berlin else None,
            city_id=berlin.id if berlin else None,
        ),
        models.Listing(
            title="Bright Room in Wedding",
            price=650,
            district="Wedding",
            address="Müllerstraße, Wedding",
            transit_info="7 min to U6 Wedding",
            description="Spacious room in a quiet, multicultural neighbourhood. Close to supermarkets, parks, and excellent transport links.",
            theme="leaf",
            rating="4.6 ★",
            state_id=berlin.state_id if berlin else None,
            city_id=berlin.id if berlin else None,
        ),
        models.Listing(
            title="Shared Flat in Mitte",
            price=600,
            district="Mitte",
            address="Near Alexanderplatz, Mitte",
            transit_info="Near Alexanderplatz",
            description="Modern shared flat in the heart of Berlin. Walk to major landmarks, great connections to all U-Bahn and S-Bahn lines.",
            theme="city",
            rating="4.7 ★",
            state_id=berlin.state_id if berlin else None,
            city_id=berlin.id if berlin else None,
        ),
        models.Listing(
            title="Studio in Prenzlauer Berg",
            price=780,
            district="Prenzlauer Berg",
            address="Schönhauser Allee",
            transit_info="5 min to U2 Eberswalder Straße",
            description="Self-contained studio in one of Berlin's most vibrant neighbourhoods. Perfect for working professionals.",
            theme="leaf",
            rating="4.9 ★",
            is_top_match=True,
            state_id=berlin.state_id if berlin else None,
            city_id=berlin.id if berlin else None,
        ),
        models.Listing(
            title="Room near TU Berlin",
            price=620,
            district="Charlottenburg",
            address="Hardenbergstraße, Charlottenburg",
            transit_info="10 min walk to TU Berlin",
            description="Ideal for TU Berlin students. Quiet room with a dedicated study desk, great Wi-Fi, and a supportive flatmate community.",
            theme="city",
            rating="4.7 ★",
            state_id=berlin.state_id if berlin else None,
            city_id=berlin.id if berlin else None,
        ),
    ])
    db.commit()


def get_state(db: Session, abbreviation: str) -> models.State | None:
    return db.query(models.State).filter(models.State.abbreviation == abbreviation).first()


def get_city(db: Session, name: str, state_abbreviation: str) -> models.City | None:
    state = get_state(db, state_abbreviation)
    if not state:
        return None
    return (
        db.query(models.City)
        .filter(models.City.name == name, models.City.state_id == state.id)
        .first()
    )


def seed_geography(db: Session) -> None:
    for name, abbreviation, capital in STATES:
        if not get_state(db, abbreviation):
            db.add(models.State(name=name, abbreviation=abbreviation, capital_city=capital))
    db.commit()

    for name, state_abbr, lat, lng, population, tier_1, tier_2 in CITIES:
        state = get_state(db, state_abbr)
        if state and not get_city(db, name, state_abbr):
            db.add(models.City(
                name=name,
                state_id=state.id,
                latitude=lat,
                longitude=lng,
                population=population,
                is_tier_1=tier_1,
                is_tier_2=tier_2,
                is_active=True,
            ))
    db.commit()


def seed_emergency_services(db: Session) -> None:
    if db.query(models.EmergencyService).count() > 0:
        return
    for name, phone, description, scope, state_abbr, category, available_24h, languages in EMERGENCY_SERVICES:
        state = get_state(db, state_abbr) if state_abbr else None
        db.add(models.EmergencyService(
            name=name,
            phone=phone,
            description=description,
            scope=scope,
            state_id=state.id if state else None,
            category=category,
            available_24h=available_24h,
            languages=languages,
        ))
    db.commit()


def seed_rathaus_offices(db: Session) -> None:
    if db.query(models.RathausOffice).count() > 0:
        return
    major_city_names = [
        "Berlin", "Hamburg", "München", "Frankfurt am Main", "Köln",
        "Düsseldorf", "Dortmund", "Essen", "Stuttgart", "Hannover",
        "Dresden", "Leipzig", "Bremen", "Nürnberg", "Bonn", "Kiel",
        "Mainz", "Rostock", "Freiburg", "Potsdam",
    ]
    cities = (
        db.query(models.City)
        .filter(models.City.name.in_(major_city_names))
        .all()
    )
    for city in cities:
        state = db.query(models.State).filter(models.State.id == city.state_id).first()
        city_label = city.name
        base_address = f"Rathausplatz 1, {city_label}"
        db.add_all([
            models.RathausOffice(
                name=f"Ausländerbehörde {city_label}",
                office_type="auslaenderbehorde",
                city_id=city.id,
                state_id=city.state_id,
                address=base_address,
                phone="115",
                website="https://service.berlin.de/" if city_label == "Berlin" else None,
                latitude=city.latitude + 0.01,
                longitude=city.longitude + 0.01,
                appointment_url="https://service.berlin.de/dienstleistung/120686/",
                osm_id=f"seed-ab-{city.id}",
                is_verified=city_label in {"Berlin", "München", "Rostock"},
            ),
            models.RathausOffice(
                name=f"Bürgeramt {city_label}",
                office_type="buergeramt",
                city_id=city.id,
                state_id=city.state_id,
                address=base_address,
                phone="115",
                website=None,
                latitude=city.latitude,
                longitude=city.longitude,
                appointment_url="https://www.115.de/",
                osm_id=f"seed-ba-{city.id}",
                is_verified=state.abbreviation == "BE" if state else False,
            ),
        ])
    db.commit()


def backfill_listing_cities(db: Session) -> None:
    berlin = get_city(db, "Berlin", "BE")
    if not berlin:
        return
    changed = False
    for listing in db.query(models.Listing).filter(models.Listing.city_id.is_(None)).all():
        listing.city_id = berlin.id
        listing.state_id = berlin.state_id
        changed = True
    if changed:
        db.commit()


def seed_events(db: Session) -> None:
    if db.query(models.Event).count() > 0:
        return
    db.add_all([
        models.Event(title="Kenyan Professionals Meetup", date_str="Sat 14 Jun · 6:00 PM", location="Neukölln Community Center", rsvp_count=34, tag="Networking"),
        models.Event(title="Anmeldung Help Session", date_str="Sun 15 Jun · 3:00 PM", location="Wedding Public Library", rsvp_count=12, tag="Admin help"),
        models.Event(title="Welcome Newcomers Coffee", date_str="Wed 18 Jun · 10:00 AM", location="Friedrichshain Café", rsvp_count=8, tag="Social"),
    ])
    db.commit()


def seed_demo_user(db: Session) -> models.User:
    user = db.query(models.User).filter(models.User.email == "james@example.com").first()
    if user:
        return user
    user = models.User(
        email="james@example.com",
        password_hash=hash_password("password123"),
        full_name="James Mwangi",
        location="Neukölln, Berlin",
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def seed_community(db: Session, user_id: int) -> None:
    if db.query(models.CommunityPost).count() > 0:
        return
    db.add_all([
        models.CommunityPost(user_id=user_id, author_name="Mercy W.", author_area="Neukölln", body="Best affordable supermarkets in Berlin?", tab="Questions", likes=24, comments=18),
        models.CommunityPost(user_id=user_id, author_name="Brian O.", author_area="Wedding", body="Looking for someone heading to Anmeldung this week — let's go together!", tab="For You", likes=15, comments=12),
        models.CommunityPost(user_id=user_id, author_name="Grace M.", author_area="Kreuzberg", body="My 5 tips for getting Anmeldung done fast 🎉", tab="Tips", likes=42, comments=31),
        models.CommunityPost(user_id=user_id, author_name="Mary K.", author_area="Mitte", body="What is the best SIM card for new arrivals in Berlin?", tab="Questions", likes=18, comments=14),
        models.CommunityPost(user_id=user_id, author_name="James M.", author_area="Neukölln", body="Do I need a German bank account before Anmeldung?", tab="Questions", likes=22, comments=17),
        models.CommunityPost(user_id=user_id, author_name="John K.", author_area="Neukölln", body="Always book your Bürgeramt at 8am — slots go within minutes!", tab="Tips", likes=44, comments=18),
        models.CommunityPost(user_id=user_id, author_name="Alice N.", author_area="Mitte", body="Get the BVG monthly pass. ~€86 and covers all public transport in Berlin.", tab="Tips", likes=38, comments=12),
    ])
    db.commit()


def seed_demo_saved_listing(db: Session, user_id: int) -> None:
    listing = db.query(models.Listing).filter(models.Listing.title == "Cozy Room in Neukölln").first()
    if not listing:
        return
    existing = db.query(models.SavedListing).filter(
        models.SavedListing.user_id == user_id,
        models.SavedListing.listing_id == listing.id,
    ).first()
    if not existing:
        db.add(models.SavedListing(user_id=user_id, listing_id=listing.id))
        db.commit()


def seed_demo_booking(db: Session, user_id: int) -> None:
    if db.query(models.Booking).filter(models.Booking.user_id == user_id).count() > 0:
        return
    listing = db.query(models.Listing).filter(models.Listing.title == "Cozy Room in Neukölln").first()
    if not listing:
        return
    db.add(models.Booking(
        user_id=user_id,
        listing_id=listing.id,
        listing_title=listing.title,
        listing_theme=listing.theme,
        start_date="1 Jun 2024",
        end_date="30 Jun 2024",
        price=listing.price,
        status="confirmed",
    ))
    db.commit()


def run_seed() -> None:
    ensure_schema_compatibility()
    db = SessionLocal()
    try:
        seed_geography(db)
        seed_emergency_services(db)
        seed_rathaus_offices(db)
        if settings.seed_demo_data:
            seed_listings(db)
            seed_events(db)
            user = seed_demo_user(db)
            seed_community(db, user.id)
            seed_demo_saved_listing(db, user.id)
            seed_demo_booking(db, user.id)
            print("✓ Karibu Ujerumani reference and demo data seeded")
        else:
            print("✓ Karibu Ujerumani reference data seeded")
    finally:
        db.close()
