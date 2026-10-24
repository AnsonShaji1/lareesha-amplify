from lareesha import identity, orders, razorpay


def handler(event, context):
    args = identity.args(event)
    order = orders.find_order_by_razorpay(args["razorpayOrderId"])
    if not identity.owns(event, order):
        raise Exception("Order not found")

    # Always enter capture_payment: it is idempotent for stock/payment rows and
    # re-emits OrderPaid when orderEmailSentAt is still missing.
    if order.get("paymentStatus") == "captured":
        return orders.capture_payment(
            order,
            order.get("razorpayPaymentId") or args["razorpayPaymentId"],
            order.get("razorpaySignature") or args["razorpaySignature"],
        )

    if not razorpay.verify_signature(
        args["razorpayOrderId"],
        args["razorpayPaymentId"],
        args["razorpaySignature"],
    ):
        orders.mark_failed(order)
        raise Exception("Payment verification failed")

    return orders.capture_payment(
        order,
        args["razorpayPaymentId"],
        args["razorpaySignature"],
    )
