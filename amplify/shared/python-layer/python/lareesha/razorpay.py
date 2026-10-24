import base64
import hmac
import hashlib
import json
from typing import Any
from urllib.request import Request, urlopen

from . import secrets

API = "https://api.razorpay.com/v1"


def _auth_header() -> str:
    token = base64.b64encode(
        f"{secrets.razorpay_key_id()}:{secrets.razorpay_key_secret()}".encode()
    ).decode()
    return f"Basic {token}"


def create_order(amount_paise: int, receipt: str) -> dict[str, Any]:
    payload = json.dumps(
        {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt,
            "payment_capture": 1,
        }
    ).encode()
    request = Request(
        f"{API}/orders",
        data=payload,
        headers={
            "Authorization": _auth_header(),
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urlopen(request, timeout=15) as response:
        return json.loads(response.read().decode())


def verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    expected = hmac.new(
        secrets.razorpay_key_secret().encode(),
        f"{order_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature or "")


def verify_webhook(body: bytes, signature: str) -> bool:
    expected = hmac.new(
        secrets.razorpay_webhook_secret().encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature or "")
