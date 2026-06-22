from pydantic import BaseModel, field_validator
from typing import Optional, Any, List
from datetime import datetime


class CourseCreate(BaseModel):
    code: str
    name: str
    department: Optional[str] = None
    instructor_id: Optional[int] = None
    schedule: Optional[Any] = None
    default_duration_minutes: Optional[int] = None
    shared_class_id: Optional[int] = None


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    instructor_id: Optional[int] = None
    schedule: Optional[Any] = None
    default_duration_minutes: Optional[int] = None
    shared_class_id: Optional[int] = None


class CourseResponse(BaseModel):
    id: int
    code: str
    name: str
    department: Optional[str] = None
    instructor_id: Optional[int] = None
    instructor_ids: Optional[List[int]] = None      # tüm atanmış öğretmen ID'leri
    instructor_names: Optional[List[str]] = None    # tüm atanmış öğretmen adları
    schedule: Optional[Any] = None
    default_duration_minutes: Optional[int] = None
    shared_class_id: Optional[int] = None
    created_at: datetime
    enrolled_count: Optional[int] = 0

    @field_validator("instructor_ids", mode="before")
    @classmethod
    def extract_instructor_ids(cls, v, info):
        """ORM nesnesinden course_instructors ilişkisini otomatik doldur."""
        if v is not None:
            return v
        # from_attributes modunda: CourseInstructor listesinden id'leri çek
        return None

    model_config = {"from_attributes": True}


class EnrollmentCreate(BaseModel):
    student_id: int


class EnrollmentResponse(BaseModel):
    id: int
    student_id: int
    course_id: int
    enrolled_at: datetime

    model_config = {"from_attributes": True}
