from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class CourseCreate(BaseModel):
    code: str
    name: str
    instructor_id: Optional[int] = None
    schedule: Optional[Any] = None
    default_duration_minutes: Optional[int] = None


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    instructor_id: Optional[int] = None
    schedule: Optional[Any] = None
    default_duration_minutes: Optional[int] = None


class CourseResponse(BaseModel):
    id: int
    code: str
    name: str
    instructor_id: Optional[int] = None
    schedule: Optional[Any] = None
    default_duration_minutes: Optional[int] = None
    created_at: datetime
    enrolled_count: Optional[int] = 0

    model_config = {"from_attributes": True}


class EnrollmentCreate(BaseModel):
    student_id: int


class EnrollmentResponse(BaseModel):
    id: int
    student_id: int
    course_id: int
    enrolled_at: datetime

    model_config = {"from_attributes": True}
