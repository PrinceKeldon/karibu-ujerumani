from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/community", tags=["community"])


@router.get("/posts", response_model=List[schemas.CommunityPostOut])
def get_posts(
    tab: str = "For You",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.CommunityPost)
    if tab != "For You":
        q = q.filter(models.CommunityPost.tab == tab)
    return q.order_by(models.CommunityPost.created_at.desc()).limit(20).all()


@router.post("/posts", response_model=schemas.CommunityPostOut)
def create_post(
    data: schemas.CommunityPostCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    post = models.CommunityPost(
        user_id=current_user.id,
        author_name=current_user.full_name,
        author_area=current_user.location,
        body=data.body,
        tab=data.tab,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.post("/posts/{post_id}/like")
def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        return {"error": "Not found"}
    post.likes += 1
    db.commit()
    return {"likes": post.likes}


@router.get("/events", response_model=List[schemas.EventOut])
def get_events(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Event).order_by(models.Event.created_at).all()


@router.post("/events/{event_id}/rsvp")
def rsvp_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        return {"error": "Not found"}
    event.rsvp_count += 1
    db.commit()
    return {"rsvp_count": event.rsvp_count, "title": event.title}
