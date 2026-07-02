from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..config import settings
from ..database import get_db

router = APIRouter(prefix="/admin-api", tags=["admin"])

SUPER_ADMIN_EMAILS = {"exec@frankkoine.com"}


def configured_admin_emails() -> set[str]:
    configured = {email.strip().lower() for email in settings.admin_emails.split(",") if email.strip()}
    return configured | SUPER_ADMIN_EMAILS


def audit(db: Session, actor_id: int, action: str, target_type: str, target_id: str | int | None = None, detail: str | None = None) -> None:
    db.add(models.AdminAuditLog(
        actor_user_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        detail=detail,
    ))


def get_or_bootstrap_role(user: models.User, db: Session) -> models.AdminRole | None:
    role = db.query(models.AdminRole).filter(models.AdminRole.user_id == user.id).first()
    if role:
        return role
    if user.email.lower() in configured_admin_emails():
        role = models.AdminRole(user_id=user.id, role="admin", permissions='{"super_admin": true}')
        db.add(role)
        audit(db, user.id, "bootstrap_admin", "user", user.id, user.email)
        db.commit()
        db.refresh(role)
        return role
    approved_invite = (
        db.query(models.ModeratorInvite)
        .filter(
            models.ModeratorInvite.email.ilike(user.email),
            models.ModeratorInvite.status == "approved",
        )
        .order_by(models.ModeratorInvite.created_at.desc())
        .first()
    )
    if approved_invite:
        role = models.AdminRole(
            user_id=user.id,
            role="moderator",
            permissions=approved_invite.permissions or "{}",
            created_by=approved_invite.approved_by,
        )
        db.add(role)
        audit(db, user.id, "accept_moderator_invite", "moderator_invite", approved_invite.id, user.email)
        db.commit()
        db.refresh(role)
        return role
    return None


def require_staff(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> tuple[models.User, models.AdminRole]:
    role = get_or_bootstrap_role(current_user, db)
    if not role or role.role not in {"admin", "moderator"}:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user, role


def require_admin(
    staff: tuple[models.User, models.AdminRole] = Depends(require_staff),
) -> tuple[models.User, models.AdminRole]:
    user, role = staff
    if role.role != "admin":
        raise HTTPException(status_code=403, detail="Admin approval required")
    return user, role


@router.get("/me", response_model=schemas.AdminMeOut)
def admin_me(staff: tuple[models.User, models.AdminRole] = Depends(require_staff)):
    user, role = staff
    return schemas.AdminMeOut(user_id=user.id, email=user.email, role=role.role, permissions=role.permissions)


@router.get("/summary", response_model=schemas.AdminSummaryOut)
def admin_summary(
    db: Session = Depends(get_db),
    staff: tuple[models.User, models.AdminRole] = Depends(require_staff),
):
    return schemas.AdminSummaryOut(
        pending_listings=db.query(models.Listing).filter(models.Listing.approval_status == "pending").count(),
        pending_ticketed_events=db.query(models.Event).filter(models.Event.approval_status == "pending").count(),
        open_support_cases=db.query(models.SupportCase).filter(models.SupportCase.status.in_(["open", "assigned", "escalated"])).count(),
        pending_moderator_invites=db.query(models.ModeratorInvite).filter(models.ModeratorInvite.status == "pending").count(),
        published_announcements=db.query(models.Announcement).filter(models.Announcement.status == "published").count(),
    )


@router.get("/listings", response_model=List[schemas.ListingOut])
def admin_listings(
    status: str = "pending",
    db: Session = Depends(get_db),
    staff: tuple[models.User, models.AdminRole] = Depends(require_staff),
):
    return (
        db.query(models.Listing)
        .filter(models.Listing.approval_status == status)
        .order_by(models.Listing.created_at.desc())
        .limit(100)
        .all()
    )


@router.post("/listings/{listing_id}/status", response_model=schemas.ListingOut)
def update_listing_status(
    listing_id: int,
    data: schemas.AdminAction,
    db: Session = Depends(get_db),
    staff: tuple[models.User, models.AdminRole] = Depends(require_staff),
):
    if data.status not in {"approved", "rejected", "suspended", "deleted"}:
        raise HTTPException(status_code=400, detail="Invalid listing status")
    user, _role = staff
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.approval_status = data.status
    audit(db, user.id, f"listing_{data.status}", "listing", listing_id, data.note)
    db.commit()
    db.refresh(listing)
    return listing


@router.get("/events", response_model=List[schemas.EventOut])
def admin_events(
    status: str = "pending",
    db: Session = Depends(get_db),
    staff: tuple[models.User, models.AdminRole] = Depends(require_staff),
):
    return (
        db.query(models.Event)
        .filter(models.Event.approval_status == status)
        .order_by(models.Event.created_at.desc())
        .limit(100)
        .all()
    )


@router.post("/events/{event_id}/status", response_model=schemas.EventOut)
def update_event_status(
    event_id: int,
    data: schemas.AdminAction,
    db: Session = Depends(get_db),
    staff: tuple[models.User, models.AdminRole] = Depends(require_staff),
):
    if data.status not in {"approved", "rejected", "suspended", "deleted"}:
        raise HTTPException(status_code=400, detail="Invalid event status")
    user, _role = staff
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.approval_status = data.status
    audit(db, user.id, f"event_{data.status}", "event", event_id, data.note)
    db.commit()
    db.refresh(event)
    return event


@router.get("/support/cases", response_model=List[schemas.SupportCaseAdminOut])
def admin_support_cases(
    status: str = "open",
    db: Session = Depends(get_db),
    staff: tuple[models.User, models.AdminRole] = Depends(require_staff),
):
    return (
        db.query(models.SupportCase)
        .filter(models.SupportCase.status == status)
        .order_by(models.SupportCase.created_at.desc())
        .limit(100)
        .all()
    )


@router.post("/support/cases/{case_id}", response_model=schemas.SupportCaseAdminOut)
def update_support_case(
    case_id: int,
    data: schemas.SupportCaseUpdate,
    db: Session = Depends(get_db),
    staff: tuple[models.User, models.AdminRole] = Depends(require_staff),
):
    user, _role = staff
    case = db.query(models.SupportCase).filter(models.SupportCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Support case not found")
    case.status = data.status
    if data.note:
        db.add(models.SupportCaseNote(case_id=case_id, admin_user_id=user.id, note=data.note))
    audit(db, user.id, "support_case_update", "support_case", case_id, data.note or data.status)
    db.commit()
    db.refresh(case)
    return case


@router.post("/moderator-invites", response_model=schemas.ModeratorInviteOut)
def create_moderator_invite(
    data: schemas.ModeratorInviteCreate,
    db: Session = Depends(get_db),
    staff: tuple[models.User, models.AdminRole] = Depends(require_staff),
):
    user, role = staff
    invite = models.ModeratorInvite(
        email=data.email.lower(),
        invited_by=user.id,
        status="approved" if role.role == "admin" else "pending",
        approved_by=user.id if role.role == "admin" else None,
        permissions=data.permissions or "{}",
    )
    db.add(invite)
    audit(db, user.id, "moderator_invite_created", "moderator_invite", None, data.email)
    db.commit()
    db.refresh(invite)
    return invite


@router.get("/moderator-invites", response_model=List[schemas.ModeratorInviteOut])
def list_moderator_invites(
    status: str = "pending",
    db: Session = Depends(get_db),
    staff: tuple[models.User, models.AdminRole] = Depends(require_staff),
):
    return (
        db.query(models.ModeratorInvite)
        .filter(models.ModeratorInvite.status == status)
        .order_by(models.ModeratorInvite.created_at.desc())
        .limit(100)
        .all()
    )


@router.post("/moderator-invites/{invite_id}/approve", response_model=schemas.ModeratorInviteOut)
def approve_moderator_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    staff: tuple[models.User, models.AdminRole] = Depends(require_admin),
):
    user, _role = staff
    invite = db.query(models.ModeratorInvite).filter(models.ModeratorInvite.id == invite_id).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    invite.status = "approved"
    invite.approved_by = user.id
    invite.updated_at = datetime.utcnow()
    invited_user = db.query(models.User).filter(models.User.email.ilike(invite.email)).first()
    if invited_user:
        existing_role = db.query(models.AdminRole).filter(models.AdminRole.user_id == invited_user.id).first()
        if existing_role and existing_role.role == "admin":
            raise HTTPException(status_code=403, detail="Cannot edit admin role")
        if existing_role:
            existing_role.role = "moderator"
            existing_role.permissions = invite.permissions or "{}"
            existing_role.updated_at = datetime.utcnow()
        else:
            db.add(models.AdminRole(
                user_id=invited_user.id,
                role="moderator",
                permissions=invite.permissions or "{}",
                created_by=user.id,
            ))
    audit(db, user.id, "moderator_invite_approved", "moderator_invite", invite_id, invite.email)
    db.commit()
    db.refresh(invite)
    return invite


@router.post("/moderators/{user_id}/permissions", response_model=schemas.AdminRoleOut)
def update_moderator_permissions(
    user_id: int,
    data: schemas.AdminAction,
    db: Session = Depends(get_db),
    staff: tuple[models.User, models.AdminRole] = Depends(require_admin),
):
    actor, _role = staff
    target = db.query(models.AdminRole).filter(models.AdminRole.user_id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Moderator role not found")
    if target.role == "admin":
        raise HTTPException(status_code=403, detail="Cannot edit admin permissions here")
    target.role = "moderator"
    target.permissions = data.note or target.permissions or "{}"
    target.updated_at = datetime.utcnow()
    audit(db, actor.id, "moderator_permissions_update", "user", user_id, target.permissions)
    db.commit()
    db.refresh(target)
    return target


@router.post("/announcements", response_model=schemas.AnnouncementOut)
def create_announcement(
    data: schemas.AnnouncementCreate,
    db: Session = Depends(get_db),
    staff: tuple[models.User, models.AdminRole] = Depends(require_staff),
):
    user, _role = staff
    ann = models.Announcement(
        title=data.title.strip(),
        body=data.body.strip(),
        audience=data.audience,
        channel=data.channel,
        status="published" if data.publish_now else "draft",
        published_at=datetime.utcnow() if data.publish_now else None,
        created_by=user.id,
    )
    if not ann.title or not ann.body:
        raise HTTPException(status_code=400, detail="Announcement title and body are required")
    db.add(ann)
    if data.channel == "messages":
        recipients_q = db.query(models.User).filter(models.User.id != user.id)
        if data.audience == "verified":
            recipients_q = recipients_q.filter(models.User.is_verified.is_(True))
        recipients = recipients_q.limit(500).all()
        for recipient in recipients:
            db.add(models.Message(
                from_user_id=user.id,
                from_name="Karibu Admin",
                to_user_id=recipient.id,
                body=f"{ann.title}\n\n{ann.body}",
            ))
    audit(db, user.id, "announcement_created", "announcement", None, ann.title)
    db.commit()
    db.refresh(ann)
    return ann


@router.get("/announcements", response_model=List[schemas.AnnouncementOut])
def list_announcements(
    db: Session = Depends(get_db),
    staff: tuple[models.User, models.AdminRole] = Depends(require_staff),
):
    return db.query(models.Announcement).order_by(models.Announcement.created_at.desc()).limit(100).all()


@router.get("/audit", response_model=List[schemas.AdminAuditOut])
def list_audit_logs(
    db: Session = Depends(get_db),
    staff: tuple[models.User, models.AdminRole] = Depends(require_staff),
):
    return db.query(models.AdminAuditLog).order_by(models.AdminAuditLog.created_at.desc()).limit(100).all()
