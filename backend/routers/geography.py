from math import asin, cos, radians, sin, sqrt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/geo", tags=["geography"])


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
        offices = q.all()
        with_distance = []
        for office in offices:
            if office.latitude is None or office.longitude is None:
                continue
            distance = haversine_km(lat, lng, office.latitude, office.longitude)
            if distance <= radius_km:
                with_distance.append((office, distance))
        offices_with_distance = sorted(with_distance, key=lambda item: item[1])[:limit]
        return [office_out(office, db, distance) for office, distance in offices_with_distance]

    offices = q.limit(limit * 5).all()
    return [office_out(office, db) for office in offices[:limit]]


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
