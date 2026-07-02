import random
import string
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/support", tags=["support"])

CASE_TYPE_LABELS = {
    "pastoral": "Care and support request",
    "short_stay": "Emergency short-stay",
    "embassy": "Embassy support",
    "admin": "Lost documents / urgent paperwork",
    "mental_health": "Mental health support",
}


def _gen_ref() -> str:
    return "KU-" + "".join(random.choices(string.digits, k=4))


@router.post("/cases", response_model=schemas.SupportCaseOut, status_code=201)
def create_case(
    data: schemas.SupportCaseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    case = models.SupportCase(
        user_id=current_user.id,
        case_type=data.case_type,
        description=data.description,
        contact_pref=data.contact_pref,
        case_ref=_gen_ref(),
        status="open",
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


@router.get("/cases/mine", response_model=List[schemas.SupportCaseOut])
def get_my_cases(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.SupportCase)
        .filter(models.SupportCase.user_id == current_user.id)
        .order_by(models.SupportCase.created_at.desc())
        .all()
    )
