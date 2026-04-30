from __future__ import annotations

import logging
from functools import lru_cache

from supabase import Client, create_client

from app.adapters.storage_adapter import (
    StorageAdapter,
    StorageSignedUrlError,
    StorageUploadError,
)
from app.config.settings import settings

logger = logging.getLogger(__name__)


class SupabaseStorageAdapter(StorageAdapter):
    """
    Supabase Storage implementation of StorageAdapter.

    Uses service-role key for all operations — never exposed to the client.
    A single Supabase Client instance is reused via _get_client() to avoid
    repeated TCP handshakes on every request.
    """

    def _get_client(self) -> Client:
        return _get_supabase_client()

    # ─────────────────────────────────────────────────────────────────────────
    # StorageAdapter implementation
    # ─────────────────────────────────────────────────────────────────────────

    def upload(
        self,
        bucket: str,
        path: str,
        data: bytes,
        content_type: str,
    ) -> str:
        try:
            self._get_client().storage.from_(bucket).upload(
                path=path,
                file=data,
                file_options={"content-type": content_type, "upsert": "false"},
            )
            return path
        except Exception as exc:
            raise StorageUploadError(
                f"Supabase upload failed [bucket={bucket!r} path={path!r}]: {exc}"
            ) from exc

    def delete(self, bucket: str, path: str) -> None:
        try:
            self._get_client().storage.from_(bucket).remove([path])
        except Exception:
            logger.warning(
                "Supabase delete failed (ignored) [bucket=%r path=%r]", bucket, path
            )

    def create_signed_url(
        self,
        bucket: str,
        path: str,
        expires_in: int = 3600,
    ) -> str:
        try:
            result = self._get_client().storage.from_(bucket).create_signed_url(
                path, expires_in
            )
            url = result.get("signedURL") or result.get("signedUrl")
            if not url:
                raise StorageSignedUrlError(
                    f"Empty signed URL returned [bucket={bucket!r} path={path!r}]"
                )
            return url
        except StorageSignedUrlError:
            raise
        except Exception as exc:
            raise StorageSignedUrlError(
                f"Supabase signed URL failed [bucket={bucket!r} path={path!r}]: {exc}"
            ) from exc

    def ping(self) -> bool:
        try:
            import httpx

            response = httpx.head(
                f"{settings.SUPABASE_URL}/rest/v1/",
                headers={"apikey": settings.SUPABASE_ANON_KEY},
                timeout=3.0,
            )
            return response.status_code < 500
        except Exception:
            return False


# ─────────────────────────────────────────────────────────────────────────────
# Singleton Supabase client — created once, reused across requests
# ─────────────────────────────────────────────────────────────────────────────


@lru_cache(maxsize=1)
def _get_supabase_client() -> Client:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise RuntimeError(
            "Supabase client is not configured. "
            "Check SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables."
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


# ─────────────────────────────────────────────────────────────────────────────
# Application-level singleton adapter — import this in services
# ─────────────────────────────────────────────────────────────────────────────


@lru_cache(maxsize=1)
def get_storage_adapter() -> SupabaseStorageAdapter:
    """Return the application-wide SupabaseStorageAdapter instance."""
    return SupabaseStorageAdapter()
