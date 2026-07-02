from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/community", tags=["community"])
POST_TABS = {"For You", "Questions", "Tips"}
EVENT_TAGS = {"Community", "Meetup", "Workshop", "Sports", "Faith", "Family"}


def _post_out(post: models.CommunityPost, liked_ids: set[int]) -> schemas.CommunityPostOut:
    return schemas.CommunityPostOut(
        id=post.id,
        author_name=post.author_name,
        author_area=post.author_area,
        body=post.body,
        tab=post.tab,
        likes=post.likes,
        comments=post.comments,
        created_at=post.created_at,
        is_liked=post.id in liked_ids,
    )


def _event_out(event: models.Event, rsvped_ids: set[int]) -> schemas.EventOut:
    return schemas.EventOut(
        id=event.id,
        title=event.title,
        date_str=event.date_str,
        location=event.location,
        rsvp_count=event.rsvp_count,
        tag=event.tag,
        is_rsvped=event.id in rsvped_ids,
    )


@router.get("/posts", response_model=List[schemas.CommunityPostOut])
def get_posts(
    tab: str = "For You",
    sort: str = "newest",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.CommunityPost)
    if tab != "For You":
        q = q.filter(models.CommunityPost.tab == tab)
    if sort == "most_helpful":
        q = q.order_by(models.CommunityPost.likes.desc(), models.CommunityPost.created_at.desc())
    else:
        q = q.order_by(models.CommunityPost.created_at.desc())
    posts = q.limit(50).all()
    liked_ids = {
        row.post_id
        for row in db.query(models.CommunityPostLike.post_id)
        .filter(
            models.CommunityPostLike.user_id == current_user.id,
            models.CommunityPostLike.post_id.in_([p.id for p in posts] or [0]),
        )
        .all()
    }
    return [_post_out(post, liked_ids) for post in posts]


@router.post("/posts", response_model=schemas.CommunityPostOut)
def create_post(
    data: schemas.CommunityPostCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    tab = data.tab if data.tab in POST_TABS else "For You"
    body = data.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Post body is required")
    post = models.CommunityPost(
        user_id=current_user.id,
        author_name=current_user.full_name,
        author_area=current_user.location or "Germany",
        body=body,
        tab=tab,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _post_out(post, set())


@router.post("/posts/{post_id}/like")
def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = (
        db.query(models.CommunityPostLike)
        .filter(
            models.CommunityPostLike.post_id == post_id,
            models.CommunityPostLike.user_id == current_user.id,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        post.likes = max((post.likes or 0) - 1, 0)
        liked = False
    else:
        db.add(models.CommunityPostLike(post_id=post_id, user_id=current_user.id))
        post.likes = (post.likes or 0) + 1
        liked = True
    db.commit()
    return {"liked": liked, "likes": post.likes}


@router.get("/posts/{post_id}/comments", response_model=List[schemas.CommunityCommentOut])
def get_comments(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    post = db.query(models.CommunityPost.id).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return (
        db.query(models.CommunityComment)
        .filter(models.CommunityComment.post_id == post_id)
        .order_by(models.CommunityComment.created_at.asc())
        .limit(100)
        .all()
    )


@router.post("/posts/{post_id}/comments", response_model=schemas.CommunityCommentOut)
def create_comment(
    post_id: int,
    data: schemas.CommunityCommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    body = data.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment body is required")
    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    comment = models.CommunityComment(
        post_id=post_id,
        user_id=current_user.id,
        author_name=current_user.full_name,
        body=body,
    )
    post.comments = (post.comments or 0) + 1
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.get("/events", response_model=List[schemas.EventOut])
def get_events(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    events = db.query(models.Event).order_by(models.Event.created_at.desc()).limit(50).all()
    rsvped_ids = {
        row.event_id
        for row in db.query(models.EventRsvp.event_id)
        .filter(
            models.EventRsvp.user_id == current_user.id,
            models.EventRsvp.event_id.in_([e.id for e in events] or [0]),
        )
        .all()
    }
    return [_event_out(event, rsvped_ids) for event in events]


@router.post("/events", response_model=schemas.EventOut)
def create_event(
    data: schemas.EventCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    title = data.title.strip()
    date_str = data.date_str.strip()
    location = data.location.strip()
    tag = data.tag if data.tag in EVENT_TAGS else "Community"
    if not title or not date_str or not location:
        raise HTTPException(status_code=400, detail="Title, date, and location are required")
    event = models.Event(
        user_id=current_user.id,
        title=title,
        date_str=date_str,
        location=location,
        tag=tag,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return _event_out(event, set())


@router.post("/events/{event_id}/rsvp")
def rsvp_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    existing = (
        db.query(models.EventRsvp)
        .filter(
            models.EventRsvp.event_id == event_id,
            models.EventRsvp.user_id == current_user.id,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        event.rsvp_count = max((event.rsvp_count or 0) - 1, 0)
        rsvped = False
    else:
        db.add(models.EventRsvp(event_id=event_id, user_id=current_user.id))
        event.rsvp_count = (event.rsvp_count or 0) + 1
        rsvped = True
    db.commit()
    return {"rsvped": rsvped, "rsvp_count": event.rsvp_count, "title": event.title}
