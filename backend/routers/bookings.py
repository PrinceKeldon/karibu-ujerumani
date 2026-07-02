from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("/me", response_model=List[schemas.BookingOut])
def get_bookings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Booking)
        .filter(models.Booking.user_id == current_user.id)
        .order_by(models.Booking.created_at.desc())
        .all()
    )


@router.post("", response_model=schemas.BookingOut)
def create_booking(
    data: schemas.BookingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    listing = db.query(models.Listing).filter(models.Listing.id == data.listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    booking = models.Booking(
        user_id=current_user.id,
        listing_id=data.listing_id,
        listing_title=listing.title,
        listing_theme=listing.theme,
        start_date=data.start_date,
        end_date=data.end_date,
        price=listing.price,
        status="pending",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking
