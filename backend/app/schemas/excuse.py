from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ExcuseCreate(BaseModel):
    course_id: int
    session_id: Optional[int] = None
    session_date: str
    excuse_type: str = "other"
    description: Optional[str] = None
    storage_path: Optional[str] = None


class ExcuseReview(BaseModel):
    status: str   # approved | rejected | pending
    instructor_notes: Optional[str] = None


class ExcuseResponse(BaseModel):
    id: int
    student_id: int
    course_id: int
    session_id: Optional[int] = None
    session_date: str
    excuse_type: str
    description: Optional[str] = None
    storage_path: Optional[str] = None
    status: str
    instructor_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
