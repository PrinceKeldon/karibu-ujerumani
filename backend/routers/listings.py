import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/listings", tags=["listings"])


LISTING_UPDATE_FIELDS = {
    "title",
    "price",
    "district",
    "postcode",
    "city_name",
    "state_name",
    "city_id",
    "state_id",
    "address",
    "transit_info",
    "description",
    "latitude",
    "longitude",
    "theme",
}


def normalize_listing_payload(payload: dict, db: Session) -> dict:
    city = db.query(models.City).filter(models.City.id == payload.get("city_id")).first() if payload.get("city_id") else None
    if city:
        payload["city_name"] = payload.get("city_name") or city.name
        state = db.query(models.State).filter(models.State.id == city.state_id).first()
        payload["state_id"] = payload.get("state_id") or city.state_id
        payload["state_name"] = payload.get("state_name") or (state.name if state else None)
        payload["latitude"] = payload.get("latitude") or city.latitude
        payload["longitude"] = payload.get("longitude") or city.longitude
    payload["district"] = (
        (payload.get("district") or "").strip()
        or payload.get("city_name")
        or payload.get("postcode")
        or "Germany"
    )
    return payload


def apply_listing_update(listing: models.Listing, data: schemas.ListingUpdate, db: Session) -> None:
    payload = data.model_dump(exclude_unset=True)
    if not payload:
        return
    if {"district", "postcode", "city_name", "city_id"} & payload.keys():
        payload = normalize_listing_payload(payload, db)
    for field, value in payload.items():
        if field in LISTING_UPDATE_FIELDS:
            setattr(listing, field, value)


def _with_saved(listings, user_id: int, db: Session) -> List[schemas.ListingOut]:
    saved_ids = {
        sl.listing_id
        for sl in db.query(models.SavedListing)
        .filter(models.SavedListing.user_id == user_id)
        .all()
    }
    result = []
    for l in listings:
        out = schemas.ListingOut.model_validate(l)
        out.is_saved = l.id in saved_ids
        result.append(out)
    return result


@router.post("", response_model=schemas.ListingOut, status_code=201)
def create_listing(
    data: schemas.ListingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    city = db.query(models.City).filter(models.City.id == data.city_id).first() if data.city_id else None
    payload = data.model_dump()
    payload["state_id"] = data.state_id or (city.state_id if city else None)
    payload["images"] = json.dumps(data.images[:3])
    payload = normalize_listing_payload(payload, db)
    listing = models.Listing(
        **payload,
        host_id=current_user.id,
        rating="New ★",
        is_top_match=False,
        approval_status="pending",
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return schemas.ListingOut.model_validate(listing)


@router.get("", response_model=List[schemas.ListingOut])
def get_listings(
    district: Optional[str] = Query(None),
    budget_max: Optional[int] = Query(None),
    city_id: Optional[int] = Query(None),
    state_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Listing).filter(models.Listing.approval_status == "approved")
    if city_id:
        q = q.filter(models.Listing.city_id == city_id)
    if state_id:
        q = q.filter(models.Listing.state_id == state_id)
    if district:
        pattern = f"%{district}%"
        q = q.filter(
            (models.Listing.district.ilike(pattern))
            | (models.Listing.city_name.ilike(pattern))
            | (models.Listing.postcode.ilike(pattern))
            | (models.Listing.state_name.ilike(pattern))
        )
    if budget_max:
        q = q.filter(models.Listing.price <= budget_max)
    return _with_saved(q.all(), current_user.id, db)


@router.get("/saved", response_model=List[schemas.ListingOut])
def get_saved(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    saved = (
        db.query(models.SavedListing)
        .filter(models.SavedListing.user_id == current_user.id)
        .all()
    )
    ids = [s.listing_id for s in saved]
    listings = (
        db.query(models.Listing)
        .filter(
            models.Listing.id.in_(ids),
            models.Listing.approval_status == "approved",
        )
        .all()
    )
    return [schemas.ListingOut.model_validate(l, update={"is_saved": True}) for l in listings]


@router.post("/{listing_id}/save")
def toggle_save(
    listing_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = (
        db.query(models.SavedListing)
        .filter(
            models.SavedListing.user_id == current_user.id,
            models.SavedListing.listing_id == listing_id,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
        return {"saved": False}
    listing = (
        db.query(models.Listing)
        .filter(
            models.Listing.id == listing_id,
            models.Listing.approval_status == "approved",
        )
        .first()
    )
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    db.add(models.SavedListing(user_id=current_user.id, listing_id=listing_id))
    db.commit()
    return {"saved": True}


@router.patch("/{listing_id}", response_model=schemas.ListingOut)
def update_own_listing(
    listing_id: int,
    data: schemas.ListingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    listing = (
        db.query(models.Listing)
        .filter(models.Listing.id == listing_id, models.Listing.host_id == current_user.id)
        .first()
    )
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.approval_status in {"deleted"}:
        raise HTTPException(status_code=400, detail="Deleted listings cannot be edited")
    apply_listing_update(listing, data, db)
    listing.approval_status = "pending"
    db.commit()
    db.refresh(listing)
    return schemas.ListingOut.model_validate(listing)


@router.post("/{listing_id}/end", response_model=schemas.ListingOut)
def end_own_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    listing = (
        db.query(models.Listing)
        .filter(models.Listing.id == listing_id, models.Listing.host_id == current_user.id)
        .first()
    )
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.approval_status = "ended"
    db.commit()
    db.refresh(listing)
    return schemas.ListingOut.model_validate(listing)


@router.delete("/{listing_id}")
def delete_own_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    listing = (
        db.query(models.Listing)
        .filter(models.Listing.id == listing_id, models.Listing.host_id == current_user.id)
        .first()
    )
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    db.query(models.SavedListing).filter(models.SavedListing.listing_id == listing_id).delete()
    listing.approval_status = "deleted"
    db.commit()
    return {"deleted": True, "id": listing_id}
