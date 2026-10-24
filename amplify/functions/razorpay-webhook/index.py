import json
import logging

from lareesha import orders, razorpay

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    signature = headers.get("x-razorpay-signature") or ""
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        import base64

        raw = base64.b64decode(body)
    else:
        raw = body.encode() if isinstance(body, str) else body

    if not razorpay.verify_webhook(raw, signature):
        return {"statusCode": 400, "body": json.dumps({"error": "invalid signature"})}

    payload = json.loads(raw.decode())
    event_name = payload.get("event")
    payment = ((payload.get("payload") or {}).get("payment") or {}).get("entity") or {}
    razorpay_order_id = payment.get("order_id")
    payment_id = payment.get("id")
    if not razorpay_order_id:
        return {"statusCode": 200, "body": json.dumps({"ignored": True})}

    order = orders.find_order_by_razorpay(razorpay_order_id)
    if not order:
        logger.warning("Webhook for unknown order %s", razorpay_order_id)
        return {"statusCode": 200, "body": json.dumps({"unknown": True})}

    if event_name == "payment.captured":
        orders.capture_payment(order, payment_id, signature)
    elif event_name == "payment.failed" and order.get("paymentStatus") == "pending":
        orders.mark_failed(order)

    return {"statusCode": 200, "body": json.dumps({"ok": True})}
