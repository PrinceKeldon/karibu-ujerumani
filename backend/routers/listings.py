from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/listings", tags=["listings"])


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
    listing = models.Listing(
        **payload,
        host_id=current_user.id,
        rating="New ★",
        is_top_match=False,
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
    q = db.query(models.Listing)
    if city_id:
        q = q.filter(models.Listing.city_id == city_id)
    if state_id:
        q = q.filter(models.Listing.state_id == state_id)
    if district:
        q = q.filter(models.Listing.district.ilike(f"%{district}%"))
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
    listings = db.query(models.Listing).filter(models.Listing.id.in_(ids)).all()
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
    db.add(models.SavedListing(user_id=current_user.id, listing_id=listing_id))
    db.commit()
    return {"saved": True}
