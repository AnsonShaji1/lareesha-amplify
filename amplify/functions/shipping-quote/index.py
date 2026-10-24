from lareesha import identity, shipping


def handler(event, context):
    args = identity.args(event)
    zip_code = (args.get("zipCode") or "").strip()
    subtotal = int(args.get("subtotalPaise") or 0)
    if not zip_code:
        raise Exception("zipCode is required")
    zone = shipping.resolve_zone(zip_code)
    fee = shipping.fee_for_zone(zone, subtotal)
    return {
        "zipCode": zip_code,
        "subtotalPaise": subtotal,
        "shippingPaise": fee,
        "zoneName": zone.get("name") if zone else None,
        "zoneCode": zone.get("code") if zone else None,
        "baseFeePaise": int(zone.get("baseFeePaise") or 0) if zone else 0,
        "freeShippingMinOrderPaise": zone.get("freeShippingMinOrderPaise") if zone else None,
        "isFallback": zone.get("isFallback") if zone else True,
    }
