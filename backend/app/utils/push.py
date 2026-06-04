"""Expo Push Notification utilities"""
import logging
from typing import List, Optional

try:
    import requests as http_requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

from app.config.settings import settings

logger = logging.getLogger(__name__)


def send_expo_push(tokens: List[str], title: str, body: str, data: Optional[dict] = None) -> dict:
    """
    Send push notification to one or more Expo push tokens.
    Silently fails if requests library is not available.
    """
    if not REQUESTS_AVAILABLE:
        logger.warning("[Push] requests not installed, notification skipped")
        return {"error": "requests not installed"}

    if not tokens:
        return {"sent": 0}

    messages = [
        {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
        }
        for token in tokens
    ]

    try:
        resp = http_requests.post(
            settings.EXPO_PUSH_URL,
            json=messages,
            headers={
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        resp.raise_for_status()
        result = resp.json()
        # Expo tickets: her token için status kontrolü
        tickets = result.get("data", [])
        errors = [t for t in tickets if t.get("status") == "error"]
        if errors:
            for err in errors:
                logger.warning(
                    "[Push] Ticket error — %s: %s",
                    err.get("details", {}).get("error", "unknown"),
                    err.get("message", ""),
                )
        logger.info("[Push] Sent %d notifications, %d errors.", len(tokens), len(errors))
        return result
    except Exception as e:
        logger.error("[Push] Expo API error: %s", e)
        return {"error": str(e)}
