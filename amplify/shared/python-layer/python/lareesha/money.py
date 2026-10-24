from decimal import Decimal, ROUND_HALF_UP


def rupees_to_paise(value) -> int:
    if value is None or value == "":
        return 0
    amount = Decimal(str(value))
    return int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def paise_to_rupees(paise: int) -> float:
    return float(Decimal(paise) / Decimal(100))


def tax_bps_from_percent(value) -> int:
    if value is None or value == "":
        return 0
    return int((Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def tax_on(subtotal_paise: int, tax_percentage_bps: int) -> int:
    return int(
        (Decimal(subtotal_paise) * Decimal(tax_percentage_bps) / Decimal(10000)).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
    )
