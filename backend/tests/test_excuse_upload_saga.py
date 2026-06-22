import io

import pytest
from fastapi import HTTPException, UploadFile

from app.adapters.storage_adapter import StorageAdapter, StorageUploadError
from app.models.excuse import Excuse
from app.services.excuse_service import upload_excuse_document


class _FakeStorageSuccess(StorageAdapter):
    def upload(self, bucket: str, path: str, data: bytes, content_type: str) -> str:
        return path

    def delete(self, bucket: str, path: str) -> None:
        return None

    def create_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str:
        return f"https://example.test/{bucket}/{path}?exp={expires_in}"

    def ping(self) -> bool:
        return True


class _FakeStorageFailure(StorageAdapter):
    def upload(self, bucket: str, path: str, data: bytes, content_type: str) -> str:
        raise StorageUploadError("storage offline")

    def delete(self, bucket: str, path: str) -> None:
        return None

    def create_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str:
        return "https://example.test/unused"

    def ping(self) -> bool:
        return True


@pytest.mark.anyio
async def test_upload_excuse_document_marks_uploaded(db, student_user, course):
    excuse = Excuse(
        student_id=student_user.id,
        course_id=course.id,
        session_date="2024-06-01",
        excuse_type="other",
        description="test",
    )
    db.add(excuse)
    db.commit()
    db.refresh(excuse)

    file = UploadFile(
        file=io.BytesIO(b"%PDF-1.7 test"),
        filename="test.pdf",
        headers={"content-type": "application/pdf"},
    )

    storage_path = await upload_excuse_document(
        user_id=student_user.id,
        file=file,
        excuse_id=excuse.id,
        db=db,
        storage=_FakeStorageSuccess(),
    )

    db.refresh(excuse)
    assert storage_path
    assert excuse.storage_path == storage_path
    assert excuse.upload_status == "uploaded"
    assert excuse.upload_error is None
    assert excuse.document_name == "test.pdf"
    assert excuse.document_mime == "application/pdf"


@pytest.mark.anyio
async def test_upload_excuse_document_marks_failed_on_storage_error(db, student_user, course):
    excuse = Excuse(
        student_id=student_user.id,
        course_id=course.id,
        session_date="2024-06-01",
        excuse_type="other",
        description="test",
    )
    db.add(excuse)
    db.commit()
    db.refresh(excuse)

    file = UploadFile(
        file=io.BytesIO(b"\x89PNG\r\n\x1a\n"),
        filename="test.png",
        headers={"content-type": "image/png"},
    )

    with pytest.raises(HTTPException) as exc_info:
        await upload_excuse_document(
            user_id=student_user.id,
            file=file,
            excuse_id=excuse.id,
            db=db,
            storage=_FakeStorageFailure(),
        )
    assert exc_info.value.status_code == 500

    db.refresh(excuse)
    assert excuse.upload_status == "upload_failed"
    assert excuse.upload_error is not None
