from __future__ import annotations

from abc import ABC, abstractmethod


class StorageAdapter(ABC):
    """
    Abstract contract for file storage backends.

    Concrete implementations (Supabase Storage, S3, Azure Blob…) must fulfil
    this interface so that services are decoupled from any specific vendor.
    """

    @abstractmethod
    def upload(
        self,
        bucket: str,
        path: str,
        data: bytes,
        content_type: str,
    ) -> str:
        """
        Upload *data* to *bucket* at *path*.

        Returns the storage path on success.
        Raises StorageUploadError on failure.
        """

    @abstractmethod
    def delete(self, bucket: str, path: str) -> None:
        """
        Delete the object at *path* from *bucket*.

        Must be idempotent — deleting a non-existent path should not raise.
        """

    @abstractmethod
    def create_signed_url(
        self,
        bucket: str,
        path: str,
        expires_in: int = 3600,
    ) -> str:
        """
        Create a time-limited pre-signed URL for the object at *path*.

        Returns the signed URL string.
        Raises StorageSignedUrlError on failure.
        """

    @abstractmethod
    def ping(self) -> bool:
        """
        Lightweight connectivity check.

        Returns True if the storage backend is reachable, False otherwise.
        Must not raise — swallow all exceptions and return False.
        """


class StorageError(Exception):
    """Base class for all storage-related errors."""


class StorageUploadError(StorageError):
    """Raised when an upload to the storage backend fails."""


class StorageSignedUrlError(StorageError):
    """Raised when creating a signed URL fails."""
