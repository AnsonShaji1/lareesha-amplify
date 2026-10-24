import json
import logging
import os

import boto3

from lareesha import dynamo

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ses = boto3.client("ses")


def handler(event, context):
    from_email = os.environ.get("FROM_EMAIL", "noreply@lareeshaluxe.com")
    brand = os.environ.get("SITE_BRAND_NAME", "Lareesha Luxe")
    owner_emails = [
        addr.strip()
        for addr in os.environ.get("ORDER_OWNER_NOTIFICATION_EMAILS", "").split(",")
        if addr.strip()
    ]

    for record in event.get("Records") or [event]:
        detail = record.get("detail") or record
        if isinstance(detail, str):
            detail = json.loads(detail)

        order_id = detail.get("id")
        order_number = detail.get("orderNumber")

        # Skip duplicate sends once confirmation was recorded.
        if order_id:
            current = dynamo.get("ORDER_TABLE", {"id": order_id})
            if current and current.get("orderEmailSentAt"):
                logger.info(
                    "Skipping order email; already sent at %s for %s",
                    current.get("orderEmailSentAt"),
                    order_number,
                )
                continue

        customer_ok = _send_customer(detail, from_email, brand)
        owners_ok = True
        if owner_emails:
            owners_ok = _send_owners(detail, from_email, brand, owner_emails)
        elif not owner_emails:
            logger.warning("ORDER_OWNER_NOTIFICATION_EMAILS is empty; owner mail skipped")

        if order_id and (customer_ok or owners_ok):
            try:
                dynamo.update(
                    "ORDER_TABLE",
                    {"id": order_id},
                    {"orderEmailSentAt": dynamo.now_iso()},
                )
            except Exception:
                logger.exception(
                    "Failed to set orderEmailSentAt for order %s (%s)",
                    order_id,
                    order_number,
                )

    return {"ok": True}


def _items(order):
    return order.get("items") or []


def _send_customer(order, from_email, brand) -> bool:
    email = (order.get("shippingEmail") or "").strip()
    if not email:
        logger.warning(
            "No shippingEmail on order %s; customer confirmation skipped",
            order.get("orderNumber"),
        )
        return False
    body = [
        "Thank you for your order — your payment was successful.",
        "",
        f"Order number: {order.get('orderNumber')}",
        "",
        "Shipping to",
        f"  {order.get('shippingFullName')}",
        f"  {order.get('shippingAddressLine1')}",
    ]
    if order.get("shippingAddressLine2"):
        body.append(f"  {order['shippingAddressLine2']}")
    body.extend(
        [
            f"  {order.get('shippingCity')}, {order.get('shippingState')} {order.get('shippingZipCode')}",
            "",
            "Items",
        ]
    )
    for item in _items(order):
        body.append(
            f"  {item.get('productName')} x {item.get('quantity')} = ₹{(item.get('lineTotalPaise') or 0) / 100:.2f}"
        )
    body.extend(
        [
            "",
            f"  Subtotal: ₹{(order.get('subtotalPaise') or 0) / 100:.2f}",
            f"  Shipping: ₹{(order.get('shippingPaise') or 0) / 100:.2f}",
            f"  Tax: ₹{(order.get('taxPaise') or 0) / 100:.2f}",
            f"  Total paid: ₹{(order.get('totalPaise') or 0) / 100:.2f}",
        ]
    )
    try:
        ses.send_email(
            Source=from_email,
            Destination={"ToAddresses": [email]},
            Message={
                "Subject": {"Data": f"Order confirmed — {order.get('orderNumber')}"},
                "Body": {"Text": {"Data": "\n".join(body)}},
            },
        )
        logger.info("Customer order email sent to %s for %s", email, order.get("orderNumber"))
        return True
    except Exception:
        logger.exception(
            "SES customer send failed for order %s to %s",
            order.get("orderNumber"),
            email,
        )
        return False


def _send_owners(order, from_email, brand, recipients) -> bool:
    lines = [
        f"New paid order — {order.get('orderNumber')}",
        f"Customer: {order.get('shippingFullName')} ({order.get('shippingEmail')})",
        f"Total: ₹{(order.get('totalPaise') or 0) / 100:.2f}",
        f"Razorpay payment: {order.get('razorpayPaymentId')}",
    ]
    try:
        ses.send_email(
            Source=from_email,
            Destination={"ToAddresses": recipients},
            Message={
                "Subject": {"Data": f"New paid order — {order.get('orderNumber')}"},
                "Body": {"Text": {"Data": "\n".join(lines)}},
            },
        )
        logger.info(
            "Owner order email sent for %s to %s",
            order.get("orderNumber"),
            recipients,
        )
        return True
    except Exception:
        logger.exception(
            "SES owner send failed for order %s to %s",
            order.get("orderNumber"),
            recipients,
        )
        return False
