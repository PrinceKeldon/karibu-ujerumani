from math import asin, cos, radians, sin, sqrt
from typing import Optional
from urllib.parse import urlencode
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/geo", tags=["geography"])
HTTP_HEADERS = {"User-Agent": "Karibu-Ujerumani-MVP/0.1 (rathaus-finder)"}
OVERPASS_URLS = (
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
)
RATHAUS_KEYWORDS = (
    "rathaus",
    "bürgeramt",
    "buergeramt",
    "bürgerbüro",
    "buergerbuero",
    "gemeinde",
    "stadtverwaltung",
    "amt",
)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_km = 6371
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    a = (
        sin(d_lat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) ** 2
    )
    return 2 * earth_radius_km * asin(sqrt(a))


def city_out(city: models.City, db: Session, distance_km: Optional[float] = None) -> schemas.CityOut:
    state = db.query(models.State).filter(models.State.id == city.state_id).first()
    listing_count = db.query(models.Listing).filter(models.Listing.city_id == city.id).count()
    out = schemas.CityOut.model_validate(city)
    out.state_name = state.name if state else None
    out.state_abbreviation = state.abbreviation if state else None
    out.listing_count = listing_count
    out.distance_km = round(distance_km, 1) if distance_km is not None else None
    return out


def office_out(office: models.RathausOffice, db: Session, distance_km: Optional[float] = None) -> schemas.RathausOfficeOut:
    city = db.query(models.City).filter(models.City.id == office.city_id).first() if office.city_id else None
    state = db.query(models.State).filter(models.State.id == office.state_id).first() if office.state_id else None
    out = schemas.RathausOfficeOut.model_validate(office)
    out.city_name = city.name if city else None
    out.state_name = state.name if state else None
    out.state_abbreviation = state.abbreviation if state else None
    out.distance_km = round(distance_km, 2) if distance_km is not None else None
    return out


def fetch_json(url: str, *, data: bytes | None = None, timeout: int = 12) -> dict:
    request = Request(url, data=data, headers=HTTP_HEADERS)
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def geocode_address_backend(query: str) -> dict | None:
    params = urlencode({
        "q": f"{query}, Germany",
        "format": "json",
        "limit": 1,
        "countrycodes": "de",
        "addressdetails": 1,
    })
    data = fetch_json(f"https://nominatim.openstreetmap.org/search?{params}")
    if not data:
        return None
    item = data[0]
    return {
        "lat": float(item["lat"]),
        "lng": float(item["lon"]),
        "label": item.get("display_name"),
        "address": item.get("address") or {},
    }


def locality_from_address(address: dict) -> str | None:
    return (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("municipality")
        or address.get("suburb")
        or address.get("county")
    )


def discover_rathaus_from_nominatim(query: str, coords: dict, db: Session) -> int:
    saved = 0
    address = coords.get("address") or {}
    locality = (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("municipality")
        or address.get("county")
    )
    postcode = address.get("postcode")
    candidates = [query]
    if locality:
        candidates.insert(0, locality)
        if postcode:
            candidates.insert(0, f"{postcode} {locality}")
    for candidate in dict.fromkeys(candidates):
        for prefix in ("Rathaus", "Gemeinde", "Gemeindeverwaltung", "Bürgeramt"):
            params = urlencode({
                "q": f"{prefix} {candidate}, Germany",
                "format": "json",
                "limit": 5,
                "countrycodes": "de",
                "addressdetails": 1,
            })
            try:
                data = fetch_json(f"https://nominatim.openstreetmap.org/search?{params}", timeout=6)
            except (HTTPError, URLError, TimeoutError):
                continue
            for item in data:
                name = item.get("name") or item.get("display_name", "").split(",")[0]
                searchable = f"{name} {item.get('display_name', '')}".lower()
                if (
                    not name
                    or is_rejected_rathaus_name(name)
                    or not any(keyword in searchable for keyword in RATHAUS_KEYWORDS)
                ):
                    continue
                osm_type = item.get("osm_type")
                osm_numeric_id = item.get("osm_id")
                osm_id = f"{osm_type}/{osm_numeric_id}" if osm_type and osm_numeric_id else None
                office = (
                    db.query(models.RathausOffice).filter(models.RathausOffice.osm_id == osm_id).first()
                    if osm_id else None
                )
                if not office:
                    office = models.RathausOffice(osm_id=osm_id)
                    db.add(office)
                    saved += 1
                address = item.get("address") or {}
                office.name = name
                office.office_type = "buergeramt"
                office.address = item.get("display_name")
                office.latitude = float(item["lat"])
                office.longitude = float(item["lon"])
                office.source = "openstreetmap"
                office.source_url = osm_source_url(osm_type, osm_numeric_id) if osm_type and osm_numeric_id else None
                office.is_verified = False
                if address.get("state"):
                    state = db.query(models.State).filter(models.State.name == address["state"]).first()
                    if state:
                        office.state_id = state.id
            db.commit()
            if saved:
                return saved
    return saved


def is_likely_rathaus(tags: dict) -> bool:
    name = (tags.get("name") or tags.get("official_name") or "").lower()
    if is_rejected_rathaus_name(name):
        return False
    if any(keyword in name for keyword in RATHAUS_KEYWORDS):
        return True
    if tags.get("amenity") == "townhall":
        return True
    if tags.get("office") == "government" and tags.get("government") in {"administrative", "register_office"}:
        return True
    return False


def is_rejected_rathaus_name(name: str) -> bool:
    normalized = name.lower().replace(" ", "")
    return normalized in {"rathausplatz", "rathausstraße", "rathausstrasse"}


def address_from_tags(tags: dict) -> str | None:
    street = tags.get("addr:street")
    house = tags.get("addr:housenumber")
    postcode = tags.get("addr:postcode")
    city = tags.get("addr:city") or tags.get("addr:suburb")
    line = " ".join(part for part in [street, house] if part)
    place = " ".join(part for part in [postcode, city] if part)
    address = ", ".join(part for part in [line, place] if part)
    return address or None


def osm_source_url(osm_type: str, osm_id: int) -> str:
    type_map = {"node": "node", "way": "way", "relation": "relation"}
    return f"https://www.openstreetmap.org/{type_map.get(osm_type, 'node')}/{osm_id}"


def discover_rathaus_from_osm(lat: float, lng: float, radius_m: int, db: Session) -> int:
    query = f"""
    [out:json][timeout:6];
    (
      nwr(around:{radius_m},{lat},{lng})["amenity"="townhall"];
      nwr(around:{radius_m},{lat},{lng})["office"="government"]["name"~"Rathaus|Bürgeramt|Buergeramt|Bürgerbüro|Buergerbuero|Gemeinde|Stadtverwaltung|Amt",i];
    );
    out center tags;
    """
    payload = urlencode({"data": query}).encode("utf-8")
    data = None
    for url in OVERPASS_URLS:
        try:
            data = fetch_json(url, data=payload, timeout=6)
            break
        except (HTTPError, URLError, TimeoutError):
            continue
    if data is None:
        return 0
    saved = 0
    for element in data.get("elements", []):
        tags = element.get("tags") or {}
        if not is_likely_rathaus(tags):
            continue
        osm_type = element.get("type")
        osm_numeric_id = element.get("id")
        osm_id = f"{osm_type}/{osm_numeric_id}"
        center = element.get("center") or {}
        office_lat = element.get("lat") or center.get("lat")
        office_lng = element.get("lon") or center.get("lon")
        if office_lat is None or office_lng is None:
            continue
        office = db.query(models.RathausOffice).filter(models.RathausOffice.osm_id == osm_id).first()
        if not office:
            office = models.RathausOffice(osm_id=osm_id)
            db.add(office)
            saved += 1
        office.name = tags.get("name") or tags.get("official_name") or "Municipal office"
        office.office_type = "buergeramt"
        office.address = address_from_tags(tags) or tags.get("addr:full")
        office.phone = tags.get("phone") or tags.get("contact:phone")
        office.website = tags.get("website") or tags.get("contact:website")
        office.email = tags.get("email") or tags.get("contact:email")
        office.latitude = float(office_lat)
        office.longitude = float(office_lng)
        office.opening_hours = tags.get("opening_hours") or "{}"
        office.appointment_url = tags.get("appointment") or tags.get("website") or tags.get("contact:website")
        office.source = "openstreetmap"
        office.source_url = osm_source_url(osm_type, osm_numeric_id)
        office.is_verified = False
    if saved:
        db.commit()
    else:
        db.commit()
    return saved


def nearby_rathaus_offices(
    db: Session,
    lat: float,
    lng: float,
    radius_km: float,
    limit: int,
    base_query=None,
) -> list[tuple[models.RathausOffice, float]]:
    q = base_query or db.query(models.RathausOffice)
    offices = q.all()
    with_distance = []
    for office in offices:
        if office.latitude is None or office.longitude is None:
            continue
        if office.source == "openstreetmap" and is_rejected_rathaus_name(office.name or ""):
            continue
        distance = haversine_km(lat, lng, office.latitude, office.longitude)
        if distance <= radius_km:
            with_distance.append((office, distance))
    return sorted(with_distance, key=lambda item: item[1])[:limit]


@router.get("/states", response_model=list[schemas.StateOut])
def get_states(db: Session = Depends(get_db)):
    return db.query(models.State).order_by(models.State.name).all()


@router.get("/cities", response_model=list[schemas.CityOut])
def get_cities(
    state_id: Optional[int] = None,
    tier: Optional[int] = Query(None, ge=1, le=3),
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    q = db.query(models.City)
    if state_id:
        q = q.filter(models.City.state_id == state_id)
    if tier == 1:
        q = q.filter(models.City.is_tier_1.is_(True))
    elif tier == 2:
        q = q.filter(models.City.is_tier_2.is_(True))
    if active_only:
        q = q.filter(models.City.is_active.is_(True))
    cities = q.order_by(models.City.name).all()
    return [city_out(city, db) for city in cities]


@router.get("/cities/near", response_model=list[schemas.CityOut])
def get_cities_near(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(50, ge=1, le=500),
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    cities = db.query(models.City).filter(models.City.is_active.is_(True)).all()
    with_distance = [
        (city, haversine_km(lat, lng, city.latitude, city.longitude))
        for city in cities
    ]
    nearby = [
        (city, distance)
        for city, distance in sorted(with_distance, key=lambda item: item[1])
        if distance <= radius_km
    ][:limit]
    return [city_out(city, db, distance) for city, distance in nearby]


@router.get("/postcode/{postcode}", response_model=schemas.PostcodeLookupOut)
def lookup_postcode(postcode: str, db: Session = Depends(get_db)):
    normalized = "".join(ch for ch in postcode.strip() if ch.isdigit())
    if len(normalized) != 5:
        raise HTTPException(status_code=400, detail="Enter a valid 5-digit German postal code")
    coords = geocode_address_backend(normalized)
    if not coords:
        raise HTTPException(status_code=404, detail="Could not find that postal code")
    address = coords.get("address") or {}
    city_name = locality_from_address(address)
    state_name = address.get("state")
    if not city_name:
        raise HTTPException(status_code=404, detail="Could not resolve the city for that postal code")
    state = db.query(models.State).filter(models.State.name == state_name).first() if state_name else None
    city_query = db.query(models.City).filter(models.City.name.ilike(city_name))
    if state:
        city_query = city_query.filter(models.City.state_id == state.id)
    city = city_query.first()
    return schemas.PostcodeLookupOut(
        postcode=normalized,
        city_name=city_name,
        state_name=state_name,
        state_id=state.id if state else None,
        city_id=city.id if city else None,
        latitude=coords["lat"],
        longitude=coords["lng"],
        label=coords.get("label"),
    )


@router.get("/rathaus", response_model=list[schemas.RathausOfficeOut])
def get_rathaus(
    city_id: Optional[int] = None,
    state_id: Optional[int] = None,
    office_type: Optional[str] = None,
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lng: Optional[float] = Query(None, ge=-180, le=180),
    radius_km: float = Query(50, ge=0.5, le=500),
    limit: int = Query(10, ge=1, le=50),
    verified_only: bool = False,
    db: Session = Depends(get_db),
):
    q = db.query(models.RathausOffice)
    if office_type:
        q = q.filter(models.RathausOffice.office_type == office_type)
    if verified_only:
        q = q.filter(models.RathausOffice.is_verified.is_(True))
    if city_id:
        q = q.filter(models.RathausOffice.city_id == city_id)
    elif state_id:
        q = q.filter(models.RathausOffice.state_id == state_id)

    if lat is not None and lng is not None:
        offices_with_distance = nearby_rathaus_offices(db, lat, lng, radius_km, limit, q)
        return [office_out(office, db, distance) for office, distance in offices_with_distance]

    offices = q.limit(limit * 5).all()
    return [office_out(office, db) for office in offices[:limit]]


@router.get("/rathaus/search", response_model=schemas.RathausSearchOut)
def search_rathaus_by_address(
    address: str = Query(..., min_length=3),
    radius_km: float = Query(35, ge=1, le=100),
    limit: int = Query(10, ge=1, le=25),
    db: Session = Depends(get_db),
):
    query = address.strip()
    coords = geocode_address_backend(query)
    if not coords:
        raise HTTPException(status_code=404, detail="Could not find that location")

    offices_with_distance = nearby_rathaus_offices(db, coords["lat"], coords["lng"], radius_km, limit)
    if len(offices_with_distance) < min(3, limit):
        discover_rathaus_from_nominatim(query, coords, db)
        offices_with_distance = nearby_rathaus_offices(db, coords["lat"], coords["lng"], radius_km, limit)
    if len(offices_with_distance) < min(3, limit):
        discover_rathaus_from_osm(coords["lat"], coords["lng"], min(int(radius_km * 1000), 15000), db)
        offices_with_distance = nearby_rathaus_offices(db, coords["lat"], coords["lng"], radius_km, limit)

    return schemas.RathausSearchOut(
        query=query,
        latitude=coords["lat"],
        longitude=coords["lng"],
        label=coords.get("label"),
        offices=[office_out(office, db, distance) for office, distance in offices_with_distance],
    )


@router.get("/rathaus/{office_id}", response_model=schemas.RathausOfficeOut)
def get_rathaus_detail(office_id: int, db: Session = Depends(get_db)):
    office = db.query(models.RathausOffice).filter(models.RathausOffice.id == office_id).first()
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    return office_out(office, db)


@router.post("/rathaus/{office_id}/verify")
def verify_office(
    office_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    office = db.query(models.RathausOffice).filter(models.RathausOffice.id == office_id).first()
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    office.is_verified = True
    db.commit()
    return {"verified": True, "id": office.id, "verified_by": current_user.id}


@router.get("/emergency")
def get_emergency(
    state_id: Optional[int] = None,
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lng: Optional[float] = Query(None, ge=-180, le=180),
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    national_q = db.query(models.EmergencyService).filter(models.EmergencyService.scope == "national")
    if category:
        national_q = national_q.filter(models.EmergencyService.category == category)
    national = national_q.order_by(models.EmergencyService.category, models.EmergencyService.name).all()

    resolved_state_id = state_id
    resolved_state = db.query(models.State).filter(models.State.id == state_id).first() if state_id else None
    if lat is not None and lng is not None and not resolved_state_id:
        cities = db.query(models.City).all()
        nearest = min(
            cities,
            key=lambda c: haversine_km(lat, lng, c.latitude, c.longitude),
            default=None,
        )
        if nearest:
            resolved_state_id = nearest.state_id
            resolved_state = db.query(models.State).filter(models.State.id == nearest.state_id).first()

    state_specific = []
    if resolved_state_id:
        state_q = db.query(models.EmergencyService).filter(models.EmergencyService.state_id == resolved_state_id)
        if category:
            state_q = state_q.filter(models.EmergencyService.category == category)
        state_specific = state_q.order_by(models.EmergencyService.category, models.EmergencyService.name).all()

    return {
        "national": [schemas.EmergencyServiceOut.model_validate(item) for item in national],
        "state_specific": [schemas.EmergencyServiceOut.model_validate(item) for item in state_specific],
        "state_id": resolved_state_id,
        "state_name": resolved_state.name if resolved_state else None,
    }
