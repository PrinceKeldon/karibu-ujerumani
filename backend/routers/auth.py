from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..auth import hash_password, verify_password, create_access_token, get_current_user
from ..database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


def latest_verification_status(user_id: int, db: Session) -> str | None:
    req = (
        db.query(models.VerificationRequest)
        .filter(models.VerificationRequest.user_id == user_id)
        .order_by(models.VerificationRequest.created_at.desc())
        .first()
    )
    return req.status if req else None


def user_out(user: models.User, db: Session) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "location": user.location,
        "arrived_at": user.arrived_at,
        "profile_photo_url": user.profile_photo_url,
        "profile_photo_path": user.profile_photo_path,
        "is_verified": user.is_verified,
        "verification_status": "verified" if user.is_verified else latest_verification_status(user.id, db),
    }


def get_or_create_settings(user_id: int, db: Session) -> models.UserSettings:
    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == user_id).first()
    if settings:
        return settings
    settings = models.UserSettings(user_id=user_id)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


@router.post("/register", response_model=schemas.Token)
def register(data: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "user": user_out(user, db),
    }


@router.post("/login", response_model=schemas.Token)
def login(data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "user": user_out(user, db),
    }


@router.get("/me", response_model=schemas.UserOut)
def me(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return user_out(current_user, db)


@router.patch("/me", response_model=schemas.UserOut)
def update_me(
    data: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if data.full_name is not None and data.full_name.strip():
        current_user.full_name = data.full_name.strip()
    if data.location is not None:
        current_user.location = data.location.strip() or current_user.location
    if data.arrived_at is not None:
        current_user.arrived_at = data.arrived_at.strip() or None
    db.commit()
    db.refresh(current_user)
    return user_out(current_user, db)


@router.patch("/me/profile-photo", response_model=schemas.UserOut)
def update_profile_photo(
    data: schemas.ProfilePhotoUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    current_user.profile_photo_url = data.profile_photo_url
    current_user.profile_photo_path = data.profile_photo_path
    db.commit()
    db.refresh(current_user)
    return user_out(current_user, db)


@router.get("/me/settings", response_model=schemas.UserSettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return get_or_create_settings(current_user.id, db)


@router.put("/me/settings", response_model=schemas.UserSettingsOut)
def update_settings(
    data: schemas.UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    settings = get_or_create_settings(current_user.id, db)
    settings.community_replies = data.community_replies
    settings.host_messages = data.host_messages
    settings.event_reminders = data.event_reminders
    settings.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/me/verification", response_model=list[schemas.VerificationRequestOut])
def get_verification_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.VerificationRequest)
        .filter(models.VerificationRequest.user_id == current_user.id)
        .order_by(models.VerificationRequest.created_at.desc())
        .all()
    )


@router.post("/me/verification", response_model=schemas.VerificationRequestOut, status_code=201)
def create_verification_request(
    data: schemas.VerificationRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    pending = (
        db.query(models.VerificationRequest)
        .filter(
            models.VerificationRequest.user_id == current_user.id,
            models.VerificationRequest.status == "pending",
        )
        .first()
    )
    if pending:
        return pending
    req = models.VerificationRequest(
        user_id=current_user.id,
        request_type=data.request_type,
        notes=data.notes,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.get("/me/summary", response_model=schemas.ProfileSummaryOut)
def profile_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    posts = db.query(models.CommunityPost).filter(models.CommunityPost.user_id == current_user.id)
    return {
        "saved_count": db.query(models.SavedListing).filter(models.SavedListing.user_id == current_user.id).count(),
        "booking_count": db.query(models.Booking).filter(models.Booking.user_id == current_user.id).count(),
        "checklist_done_count": db.query(models.ChecklistCompletion).filter(models.ChecklistCompletion.user_id == current_user.id).count(),
        "post_count": posts.count(),
        "tips_count": posts.filter(models.CommunityPost.tab == "Tips").count(),
        "answers_count": posts.filter(models.CommunityPost.tab == "Questions").count(),
        "support_case_count": db.query(models.SupportCase).filter(models.SupportCase.user_id == current_user.id).count(),
    }
