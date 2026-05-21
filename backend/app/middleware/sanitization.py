"""
Request sanitization middleware.

Responsibilities:
1. Enforce a hard request body size limit (default 10 MB).
2. Detect obviously malicious string patterns (SQL injection, XSS probes)
   in the raw body and log them for audit purposes.
   — We log and reject, not silently strip, so nothing is swallowed without notice.
3. Ensure the Content-Type header is acceptable for POST/PUT/PATCH requests.

NOTE: Pydantic schema validators are the primary line of defense for business
logic. This middleware is a second, infrastructure-level guard.
"""

import re
import logging
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────
MAX_BODY_BYTES: int = 10 * 1024 * 1024  # 10 MB

# Patterns that are almost never legitimate in a JSON API payload.
# We keep this list conservative to avoid false positives.
_SUSPICIOUS_PATTERNS: list[re.Pattern] = [
    # Classic SQL injection probes (case-insensitive, word-boundary aware)
    re.compile(r"(?i)\b(union\s+select|drop\s+table|insert\s+into|delete\s+from|exec\s*\(|xp_cmdshell)\b"),
    # XSS: script tag or javascript: URI
    re.compile(r"(?i)<\s*script[\s>]"),
    re.compile(r"(?i)javascript\s*:"),
    # Null-byte injection
    re.compile(r"\x00"),
]

# Allowed content-types for request bodies
_ALLOWED_CONTENT_TYPES = (
    "application/json",
    "multipart/form-data",
    "application/x-www-form-urlencoded",
)


class SanitizationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # ── 1. Body size check ────────────────────────────────────────────────
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_BODY_BYTES:
            logger.warning(
                "[Sanitization] Oversized request: %s bytes from %s %s",
                content_length, request.client.host if request.client else "?",
                request.url.path,
            )
            return JSONResponse(
                status_code=413,
                content={"detail": f"İstek gövdesi çok büyük. Maksimum: {MAX_BODY_BYTES // (1024*1024)} MB."},
            )

        # ── 2. Content-type check for mutation requests ───────────────────────
        if request.method in ("POST", "PUT", "PATCH"):
            ct = request.headers.get("content-type", "")
            if ct and not any(ct.startswith(allowed) for allowed in _ALLOWED_CONTENT_TYPES):
                logger.warning(
                    "[Sanitization] Unexpected content-type '%s' from %s %s",
                    ct, request.client.host if request.client else "?",
                    request.url.path,
                )
                return JSONResponse(
                    status_code=415,
                    content={"detail": "Desteklenmeyen içerik tipi."},
                )

        # ── 3. Suspicious pattern scan (JSON bodies only, best-effort) ────────
        # Yüz kaydı/doğrulama ve konum gibi büyük base64 body içeren path'leri
        # pattern taramasından muaf tut — gereksiz CPU/bellek kullanımını önler.
        _IMAGE_PATHS = ("/face/", "/attendance/verify-face", "/attendance/web-attend")
        _skip_scan = any(request.url.path.startswith(p) or request.url.path.endswith(p)
                         for p in _IMAGE_PATHS)

        if not _skip_scan and request.method in ("POST", "PUT", "PATCH"):
            ct = request.headers.get("content-type", "")
            if "application/json" in ct:
                # Read body — Starlette caches it so downstream handlers still get it
                body_bytes = await request.body()
                if body_bytes:
                    try:
                        body_text = body_bytes.decode("utf-8", errors="replace")
                        for pattern in _SUSPICIOUS_PATTERNS:
                            if pattern.search(body_text):
                                logger.warning(
                                    "[Sanitization] Suspicious pattern matched (%s) in request from %s %s",
                                    pattern.pattern[:40],
                                    request.client.host if request.client else "?",
                                    request.url.path,
                                )
                                return JSONResponse(
                                    status_code=400,
                                    content={"detail": "Geçersiz istek içeriği."},
                                )
                    except Exception as exc:
                        logger.debug("[Sanitization] Body decode error: %s", exc)

        try:
            return await call_next(request)
        except Exception as exc:
            logger.error("[Sanitization] Unhandled exception propagated: %r", exc)
            return JSONResponse(status_code=500, content={"detail": "Sunucu hatası"})
