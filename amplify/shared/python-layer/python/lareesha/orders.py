from . import dynamo, events, scheduler, stock


def find_order_by_razorpay(razorpay_order_id: str) -> dict | None:
    matches = dynamo.query_gsi("ORDER_TABLE", "razorpayOrderId", razorpay_order_id)
    return matches[0] if matches else None


def mark_failed(order: dict) -> dict:
    scheduler.delete_schedule(order["id"])
    updated = dynamo.update(
        "ORDER_TABLE",
        {"id": order["id"]},
        {"paymentStatus": "failed", "status": "cancelled", "stockReserved": False},
    )
    stock.release_reservations(order)
    return updated


def _ensure_order_paid_email(order: dict) -> None:
    """Emit OrderPaid unless confirmation email was already recorded as sent."""
    if order.get("orderEmailSentAt"):
        return
    events.emit_order_paid(order)


def capture_payment(order: dict, payment_id: str, signature: str) -> dict:
    scheduler.delete_schedule(order["id"])

    # Already captured: skip stock/payment side effects, but re-emit email if needed.
    if order.get("paymentStatus") == "captured":
        _ensure_order_paid_email(order)
        return order

    updated = dynamo.update(
        "ORDER_TABLE",
        {"id": order["id"]},
        {
            "razorpayPaymentId": payment_id,
            "razorpaySignature": signature,
            "paymentStatus": "captured",
            "status": "on_the_way",
            "stockReserved": False,
        },
    )

    if order.get("stockReserved"):
        reservations = stock.reservations_for_order(order["id"])
        if reservations:
            adjustments = [(row["productId"], int(row["quantity"]), row["id"]) for row in reservations]
        else:
            adjustments = [
                (item["productId"], int(item.get("quantity") or 0), None)
                for item in (order.get("items") or [])
            ]
        for product_id, quantity, reservation_id in adjustments:
            product = dynamo.get("PRODUCT_TABLE", {"id": product_id})
            if product:
                dynamo.update(
                    "PRODUCT_TABLE",
                    {"id": product["id"]},
                    {"noOfStock": max(0, int(product.get("noOfStock") or 0) - quantity)},
                )
            if reservation_id:
                dynamo.delete("STOCK_RESERVATION_TABLE", {"id": reservation_id})

    existing = dynamo.query_gsi("PAYMENT_TRANSACTION_TABLE", "orderId", order["id"])
    if not existing:
        dynamo.put(
            "PAYMENT_TRANSACTION_TABLE",
            {
                "id": dynamo.new_id(),
                "__typename": "PaymentTransaction",
                "owner": order.get("owner"),
                "userId": order.get("userId") or order.get("owner"),
                "orderId": order["id"],
                "orderNumber": order["orderNumber"],
                "subtotalPaise": order["subtotalPaise"],
                "shippingPaise": order["shippingPaise"],
                "taxPaise": order["taxPaise"],
                "totalPaise": order["totalPaise"],
                "paymentMethod": "razorpay",
                "razorpayOrderId": order.get("razorpayOrderId"),
                "razorpayPaymentId": payment_id,
                "razorpaySignature": signature,
                "status": "completed",
                "createdAtIso": dynamo.now_iso(),
            },
        )

    # Raise on emit failure so webhook/verify can retry; early-return path above
    # will re-emit until orderEmailSentAt is set by order-emails.
    _ensure_order_paid_email(updated)
    return updated
