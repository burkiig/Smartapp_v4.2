import math
from typing import List, Optional, Tuple

# Sivil GPS donanımının fiziksel hassasiyet alt sınırı.
# Gerçek dünyada en iyi koşullarda ~0.5–1m hassasiyet mümkündür.
# Bu değerin altındaki accuracy değerleri donanımsal olarak üretilemez;
# yazılım manipülasyonu (fake GPS) işareti olarak kabul edilir.
_MIN_PLAUSIBLE_ACCURACY_M = 0.5


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance in metres using Haversine formula."""
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def check_gps_plausibility(
    accuracy: Optional[float],
    is_mocked: Optional[bool],
) -> List[str]:
    """
    Run GPS plausibility checks beyond geofence distance.

    Bu fonksiyon koordinat doğrulamasını schema katmanına bırakır
    (Null Island, aralık kontrolü); burada sadece donanım/yazılım
    tutarlılığını denetler.

    Returns:
        List of anomaly codes; empty list = all checks passed.

    Anomaly codes:
      "is_mocked"           — Cihaz konumun sahte (mocked) olduğunu bildirdi.
      "suspicious_accuracy" — Accuracy < 0.5m: sivil GPS donanımının
                              ulaşabileceği hassasiyetin altında; yazılımsal
                              manipülasyon göstergesi.
    """
    issues: List[str] = []

    if is_mocked:
        issues.append("is_mocked")

    if accuracy is not None and accuracy < _MIN_PLAUSIBLE_ACCURACY_M:
        issues.append("suspicious_accuracy")

    return issues


def verify_location(
    student_lat: float,
    student_lon: float,
    target_lat: float,
    target_lon: float,
    radius_m: int = 50,
    accuracy_m: Optional[float] = None,
    max_accuracy_m: float = 80.0,
) -> Tuple[bool, float]:
    """
    Check if student is within geofence.

    Returns:
        (inside: bool, distance_m: float)
    """
    # Hard-reject only when accuracy is worse than max_accuracy_m.
    # Lower-but-imperfect ranges (for example 30-80m) should continue and be
    # handled by higher-level flagging policy.
    if accuracy_m is not None and accuracy_m > max_accuracy_m:
        return False, -1.0

    distance = haversine_distance(student_lat, student_lon, target_lat, target_lon)
    return distance <= radius_m, round(distance, 1)
