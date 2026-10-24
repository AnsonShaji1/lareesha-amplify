from lareesha import identity, orders, scheduler, stock


def handler(event, context):
    razorpay_order_id = identity.args(event)["razorpayOrderId"]
    order = orders.find_order_by_razorpay(razorpay_order_id)
    is_admin = "admin" in identity.user_groups(event)
    if not order or (not is_admin and not identity.owns(event, order)):
        raise Exception("Order not found")

    if order.get("paymentStatus") == "captured":
        return {
            "message": "Payment already captured",
            "status": order.get("status"),
            "paymentStatus": order.get("paymentStatus"),
        }

    if order.get("paymentStatus") == "failed":
        scheduler.delete_schedule(order["id"])
        if order.get("stockReserved"):
            stock.release_reservations(order)
        return {
            "message": "Payment already failed",
            "status": order.get("status"),
            "paymentStatus": order.get("paymentStatus"),
        }

    updated = orders.mark_failed(order)
    return {
        "message": "Order cancelled, stock released",
        "status": updated.get("status"),
        "paymentStatus": updated.get("paymentStatus"),
    }
