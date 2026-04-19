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
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        logger.info(f"[Push] Sent {len(tokens)} notifications. Status: {resp.status_code}")
        return resp.json()
    except Exception as e:
        logger.error(f"[Push] Expo API error: {e}")
        return {"error": str(e)}
