"""Seed product reference data."""
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from . import models
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
    ("Kenyan Embassy Berlin", "+4930 25926611", "Emergency consular assistance for Kenyan nationals.", "national", None, "embassy", False, "English, Swahili, German"),
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
    table_names = inspector.get_table_names()
    if "listings" not in table_names:
        return
    listing_columns = {c["name"] for c in inspector.get_columns("listings")}
    user_columns = {c["name"] for c in inspector.get_columns("users")} if "users" in table_names else set()
    event_columns = {c["name"] for c in inspector.get_columns("events")} if "events" in table_names else set()
    emergency_columns = {c["name"] for c in inspector.get_columns("emergency_services")} if "emergency_services" in table_names else set()
    rathaus_columns = {c["name"] for c in inspector.get_columns("rathaus_offices")} if "rathaus_offices" in table_names else set()
    statements = []
    if "state_id" not in listing_columns:
        statements.append("ALTER TABLE listings ADD COLUMN state_id INTEGER")
    if "city_id" not in listing_columns:
        statements.append("ALTER TABLE listings ADD COLUMN city_id INTEGER")
    if "approval_status" not in listing_columns:
        statements.append("ALTER TABLE listings ADD COLUMN approval_status VARCHAR DEFAULT 'approved' NOT NULL")
    if "profile_photo_url" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN profile_photo_url TEXT")
    if "profile_photo_path" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN profile_photo_path TEXT")
    if "events" in table_names and "user_id" not in event_columns:
        statements.append("ALTER TABLE events ADD COLUMN user_id INTEGER")
    if "events" in table_names:
        if "is_ticketed" not in event_columns:
            statements.append("ALTER TABLE events ADD COLUMN is_ticketed BOOLEAN DEFAULT FALSE NOT NULL")
        if "ticket_url" not in event_columns:
            statements.append("ALTER TABLE events ADD COLUMN ticket_url VARCHAR")
        if "ticket_price" not in event_columns:
            statements.append("ALTER TABLE events ADD COLUMN ticket_price VARCHAR")
        if "approval_status" not in event_columns:
            statements.append("ALTER TABLE events ADD COLUMN approval_status VARCHAR DEFAULT 'approved' NOT NULL")
    if "emergency_services" in table_names:
        for column in ("website", "address", "map_url", "office_hours"):
            if column not in emergency_columns:
                statements.append(f"ALTER TABLE emergency_services ADD COLUMN {column} VARCHAR")
    if "rathaus_offices" in table_names:
        for column in ("source", "source_url"):
            if column not in rathaus_columns:
                statements.append(f"ALTER TABLE rathaus_offices ADD COLUMN {column} VARCHAR")
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))


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
    if db.query(models.EmergencyService).count() == 0:
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
    embassy = (
        db.query(models.EmergencyService)
        .filter(models.EmergencyService.name == "Kenyan Embassy Berlin")
        .first()
    )
    if embassy:
        embassy.phone = "+4930 25926611"
        embassy.website = "https://kenyanembassyberlin.de/"
        embassy.address = "Rheinbabenallee 49, 14199 Berlin, Germany"
        embassy.map_url = "https://kenyanembassyberlin.de/contact-us/#"
        embassy.office_hours = "Mon-Fri 09:00-13:00"
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


def run_seed() -> None:
    ensure_schema_compatibility()
    db = SessionLocal()
    try:
        seed_geography(db)
        seed_emergency_services(db)
        seed_rathaus_offices(db)
        print("✓ Karibu Ujerumani reference data seeded")
    finally:
        db.close()
