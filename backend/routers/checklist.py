from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/checklist", tags=["checklist"])


@router.get("/me")
def get_checklist(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    completions = (
        db.query(models.ChecklistCompletion)
        .filter(models.ChecklistCompletion.user_id == current_user.id)
        .all()
    )
    return {"completed": [c.task_key for c in completions]}


@router.post("/toggle")
def toggle_task(
    data: schemas.ChecklistToggle,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = (
        db.query(models.ChecklistCompletion)
        .filter(
            models.ChecklistCompletion.user_id == current_user.id,
            models.ChecklistCompletion.task_key == data.task_key,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
        return {"completed": False, "task_key": data.task_key}
    db.add(models.ChecklistCompletion(user_id=current_user.id, task_key=data.task_key))
    db.commit()
    return {"completed": True, "task_key": data.task_key}
