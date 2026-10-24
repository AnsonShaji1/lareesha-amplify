from . import dynamo


def reserved_quantity(product_id: str) -> int:
    now = dynamo.now_epoch()
    reservations = dynamo.query_gsi(
        "STOCK_RESERVATION_TABLE",
        "productId",
        product_id,
        sort_name="expiresAtEpoch",
    )
    return sum(int(r.get("quantity") or 0) for r in reservations if int(r.get("expiresAtEpoch") or 0) > now)


def available_stock(product: dict) -> int:
    return max(0, int(product.get("noOfStock") or 0) - reserved_quantity(product["id"]))


def reservations_for_order(order_id: str) -> list[dict]:
    return dynamo.query_gsi("STOCK_RESERVATION_TABLE", "orderId", order_id)


def release_reservations(order: dict) -> None:
    for reservation in reservations_for_order(order["id"]):
        dynamo.delete("STOCK_RESERVATION_TABLE", {"id": reservation["id"]})
    dynamo.update(
        "ORDER_TABLE",
        {"id": order["id"]},
        {"stockReserved": False},
    )
