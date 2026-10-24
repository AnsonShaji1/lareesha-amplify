import re
from typing import Any

from . import dynamo


def normalized_pincode(zip_code: str) -> str:
    digits = re.sub(r"\D", "", zip_code or "")
    return digits[:6]


def resolve_zone(zip_code: str) -> dict[str, Any] | None:
    normalized = normalized_pincode(zip_code)
    if len(normalized) >= 3:
        for length in range(min(len(normalized), 6), 2, -1):
            candidate = normalized[:length]
            mapping = dynamo.get("SHIPPING_PIN_PREFIX_TABLE", {"prefix": candidate})
            if mapping:
                zone = dynamo.get("SHIPPING_ZONE_TABLE", {"id": mapping["zoneId"]})
                if zone and zone.get("isActive"):
                    return zone

    zones = dynamo.scan("SHIPPING_ZONE_TABLE")
    fallbacks = [
        z
        for z in zones
        if z.get("isActive") and z.get("isFallback")
    ]
    fallbacks.sort(key=lambda z: (z.get("priority") or 999, z.get("id") or ""))
    return fallbacks[0] if fallbacks else None


def fee_for_zone(zone: dict[str, Any] | None, subtotal_paise: int) -> int:
    if not zone:
        return 0
    threshold = zone.get("freeShippingMinOrderPaise")
    if threshold is not None and subtotal_paise >= int(threshold):
        return 0
    return int(zone.get("baseFeePaise") or 0)


def fee_for_address(address: dict[str, Any] | None, subtotal_paise: int) -> tuple[int, dict[str, Any] | None]:
    if not address:
        return 0, None
    zone = resolve_zone(address.get("zipCode") or "")
    return fee_for_zone(zone, subtotal_paise), zone
