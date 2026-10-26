from typing import Any

from . import dynamo

DEFAULT_SHIPPING_ID = "default"


def current_fee_paise() -> int:
    """Flat store shipping from the single Shipping row (id=default)."""
    row = dynamo.get("SHIPPING_TABLE", {"id": DEFAULT_SHIPPING_ID})
    if not row:
        return 0
    if row.get("isFreeShipping"):
        return 0
    return int(row.get("feePaise") or 0)


def fee_for_address(
    address: dict[str, Any] | None,
    subtotal_paise: int,
) -> tuple[int, dict[str, Any] | None]:
    """Return shipping fee. Address and subtotal are unused; kept for call-site compatibility."""
    _ = address, subtotal_paise
    return current_fee_paise(), None
