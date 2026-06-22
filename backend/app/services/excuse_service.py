from __future__ import annotations

from pathlib import Path
from uuid import uuid4
import logging

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.adapters.storage_adapter import StorageAdapter, StorageUploadError, StorageSignedUrlError
from app.adapters.supabase_storage import get_storage_adapter
from app.repositories.excuse_repo import ExcuseRepository
from app.services.audit_service import log_action

ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB
BUCKET_NAME = "excuse-documents"
logger = logging.getLogger(__name__)


async def upload_excuse_document(
    user_id: int,
    file: UploadFile,
    excuse_id: int,
    db: Session,
    storage: StorageAdapter | None = None,
) -> str:
    """
    Upload an excuse document to storage and update the DB record.

    Audit trail:
        upload_started  — written before any I/O so orphan files can be detected
        excuse_upload   — written only after both storage and DB succeed
        excuse_orphan_file — written if compensating delete also fails

    Parameters
    ----------
    storage:
        Injected StorageAdapter. Defaults to the app-wide SupabaseStorageAdapter.
        Pass a test double in unit tests to avoid real network calls.
    """
    if storage is None:
        storage = get_storage_adapter()

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: PDF, JPG, PNG.",
        )

    repo = ExcuseRepository(db)
    excuse = repo.get_by_id(excuse_id)
    if not excuse:
        raise HTTPException(status_code=404, detail="Mazeret bulunamadı")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file upload is not allowed.")
    if len(file_bytes) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10 MB.")

    ext = Path(file.filename or "").suffix.lower().replace(".", "")
    if ext not in {"pdf", "jpg", "jpeg", "png"}:
        ext = "pdf" if file.content_type == "application/pdf" else "jpg"

    storage_path = f"{user_id}/{excuse_id}/{uuid4()}.{ext}"
    upload_file_name = file.filename or f"excuse.{ext}"

    # Saga step 1 — mark pending before storage I/O.
    repo.update(
        excuse,
        upload_status="pending_upload",
        upload_error=None,
        document_mime=file.content_type,
        document_name=upload_file_name,
    )

    # ── Audit: record intent before any I/O ──────────────────────────────────
    # If the process crashes after upload but before DB commit, this log entry
    # lets operators find orphaned files in storage by querying audit_logs
    # for upload_started rows without a matching excuse_upload row.
    log_action(
        db,
        action="upload_started",
        actor_id=user_id,
        resource="excuses",
        resource_id=excuse_id,
        detail={"storage_path": storage_path, "content_type": file.content_type},
    )

    try:
        storage.upload(BUCKET_NAME, storage_path, file_bytes, file.content_type)
        repo.update(
            excuse,
            storage_path=storage_path,
            upload_status="uploaded",
            upload_error=None,
            document_mime=file.content_type,
            document_name=upload_file_name,
        )
        log_action(
            db,
            action="excuse_upload",
            actor_id=user_id,
            resource="excuses",
            resource_id=excuse_id,
            detail={"storage_path": storage_path},
        )
        return storage_path

    except StorageUploadError as exc:
        repo.update(
            excuse,
            upload_status="upload_failed",
            upload_error=str(exc)[:500],
        )
        raise HTTPException(
            status_code=500, detail=f"Excuse document upload failed: {exc}"
        ) from exc

    except Exception as exc:
        # Upload succeeded but DB update failed → orphan file → compensating delete.
        try:
            storage.delete(BUCKET_NAME, storage_path)
        except Exception:
            log_action(
                db,
                action="excuse_orphan_file",
                actor_id=user_id,
                resource="excuses",
                resource_id=excuse_id,
                detail={"storage_path": storage_path, "error": "cleanup_failed"},
            )
            logger.warning(
                "cleanup_failed for excuse upload orphan file path=%s", storage_path
            )
        try:
            repo.update(
                excuse,
                upload_status="upload_failed",
                upload_error=str(exc)[:500],
            )
        except Exception:
            logger.warning("failed to persist upload_failed status for excuse_id=%s", excuse_id)
        raise HTTPException(
            status_code=500, detail=f"Excuse document upload failed: {exc}"
        ) from exc


def get_excuse_signed_url(
    storage_path: str,
    requesting_user_id: int,
    requesting_user_role: str,
    db: Session,
    expires_in: int = 3600,
    storage: StorageAdapter | None = None,
    excuse_owner_id: int | None = None,
) -> str:
    """
    Generate a time-limited signed URL for an excuse document.

    Access rules:
      - instructors and admins can always fetch the signed URL.
      - a student may fetch the URL only for their own excuse document
        (i.e. when requesting_user_id == excuse_owner_id).

    The URL is never persisted in the database — it is generated on demand.

    Parameters
    ----------
    excuse_owner_id:
        The student_id stored on the excuse row.  Pass this from the API
        layer so no extra DB query is needed here.
    storage:
        Injected StorageAdapter. Defaults to the app-wide SupabaseStorageAdapter.
    """
    if storage is None:
        storage = get_storage_adapter()

    is_privileged = requesting_user_role in {"instructor", "admin"}
    is_own_document = (
        requesting_user_role == "student"
        and excuse_owner_id is not None
        and requesting_user_id == excuse_owner_id
    )
    if not is_privileged and not is_own_document:
        raise HTTPException(
            status_code=403,
            detail="Bu belgeye erişim yetkiniz yok.",
        )

    try:
        signed_url = storage.create_signed_url(BUCKET_NAME, storage_path, expires_in)
    except StorageSignedUrlError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    log_action(
        db,
        action="excuse_signed_url",
        actor_id=requesting_user_id,
        actor_role=requesting_user_role,
        resource="excuses",
        detail={"storage_path": storage_path, "expires_in": expires_in},
    )
    return signed_url
