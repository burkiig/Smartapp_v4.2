import math
from typing import Tuple, Optional


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate great-circle distance in metres using Haversine formula.
    """
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def verify_location(
    student_lat: float,
    student_lon: float,
    target_lat: float,
    target_lon: float,
    radius_m: int = 50,
    accuracy_m: Optional[float] = None,
    max_accuracy_m: float = 30.0,
) -> Tuple[bool, float]:
    """
    Check if student is within geofence.

    Returns:
        (inside: bool, distance_m: float)
    """
    if accuracy_m is not None and accuracy_m > max_accuracy_m:
        return False, -1.0   # GPS too inaccurate

    distance = haversine_distance(student_lat, student_lon, target_lat, target_lon)
    return distance <= radius_m, round(distance, 1)
