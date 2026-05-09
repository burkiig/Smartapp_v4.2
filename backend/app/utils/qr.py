import secrets
import base64
import io
import qrcode


def generate_qr_token() -> str:
    """Generate a secure random QR token"""
    return secrets.token_urlsafe(32)


def build_qr_payload(session_id: int, course_id: int, token: str) -> str:
    return f"session_id={session_id};course_id={course_id};token={token}"


def parse_qr_payload(payload: str) -> dict:
    """Parse QR payload string into dict. Returns empty dict on failure."""
    try:
        parts = {}
        for item in payload.split(";"):
            k, v = item.split("=", 1)
            parts[k.strip()] = v.strip()
        return parts
    except Exception:
        return {}


def generate_qr_image_base64(payload: str) -> str:
    """Generate QR code image as base64 string"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return f"data:image/png;base64,{base64.b64encode(buffer.read()).decode()}"
