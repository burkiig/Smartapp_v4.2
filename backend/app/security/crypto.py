from __future__ import annotations

import base64
from typing import Dict

from cryptography.fernet import Fernet, InvalidToken

from app.config.settings import settings


class KeyRotationError(Exception):
    pass


class EmbeddingCrypto:
    def __init__(self) -> None:
        self._keys = self._build_keyring()

    def _build_keyring(self) -> Dict[str, Fernet]:
        if not settings.ENCRYPTION_KEY:
            return {}
        raw = settings.ENCRYPTION_KEY.encode("utf-8")
        if len(raw) < 32:
            raise KeyRotationError(
                "ENCRYPTION_KEY must be at least 32 bytes. "
                "Generate a secure key with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        try:
            # Use exactly 32 bytes — no predictable padding
            fernet_key = base64.urlsafe_b64encode(raw[:32])
            return {"v1": Fernet(fernet_key)}
        except Exception as exc:
            raise KeyRotationError("Invalid ENCRYPTION_KEY format.") from exc

    def encrypt(self, data: bytes, key_version: str = "v1") -> bytes:
        if not data:
            return data
        fernet = self._keys.get(key_version)
        if not fernet:
            raise KeyRotationError(f"Encryption key version not found: {key_version}")
        token = fernet.encrypt(data).decode("utf-8")
        return f"{key_version}:{token}".encode("utf-8")

    def decrypt(self, data: bytes) -> bytes:
        if not data:
            return data
        try:
            payload = data.decode("utf-8")
            if ":" not in payload:
                return data
            key_version, token = payload.split(":", 1)
            fernet = self._keys.get(key_version)
            if not fernet:
                raise KeyRotationError(f"No key configured for version: {key_version}")
            return fernet.decrypt(token.encode("utf-8"))
        except InvalidToken as exc:
            raise KeyRotationError("Failed to decrypt embedding: invalid token.") from exc


embedding_crypto = EmbeddingCrypto()
