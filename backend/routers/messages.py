from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("", response_model=List[schemas.ConversationOut])
def get_conversations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    messages = (
        db.query(models.Message)
        .filter(
            (models.Message.from_user_id == current_user.id)
            | (models.Message.to_user_id == current_user.id)
        )
        .order_by(models.Message.created_at.desc())
        .all()
    )
    seen: dict = {}
    for m in messages:
        other_id = m.to_user_id if m.from_user_id == current_user.id else m.from_user_id
        if other_id not in seen:
            is_incoming = m.to_user_id == current_user.id
            other_user = db.query(models.User).filter(models.User.id == other_id).first()
            other_name = other_user.full_name if other_user else m.from_name
            seen[other_id] = {
                "message_id": m.id,
                "other_user_id": other_id,
                "name": m.from_name if is_incoming else "You → " + other_name,
                "body": m.body,
                "is_read": m.is_read,
                "time": m.created_at.strftime("%H:%M"),
                "unread_count": 1 if (is_incoming and not m.is_read) else 0,
            }
    return list(seen.values())


@router.post("")
def send_message(
    data: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    recipient = db.query(models.User).filter(models.User.id == data.to_user_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Message recipient not found")
    msg = models.Message(
        from_user_id=current_user.id,
        from_name=current_user.full_name,
        to_user_id=data.to_user_id,
        body=data.body,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"id": msg.id, "sent": True}


@router.delete("/{message_id}")
def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    msg = (
        db.query(models.Message)
        .filter(
            models.Message.id == message_id,
            (models.Message.from_user_id == current_user.id)
            | (models.Message.to_user_id == current_user.id),
        )
        .first()
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    db.delete(msg)
    db.commit()
    return {"deleted": True, "id": message_id}
