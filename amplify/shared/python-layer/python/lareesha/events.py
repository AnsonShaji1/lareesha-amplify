import json
import os

import boto3

_events = boto3.client("events")


def emit_order_paid(order: dict) -> None:
    bus = os.environ.get("EVENT_BUS_NAME", "default")
    response = _events.put_events(
        Entries=[
            {
                "Source": "lareesha.orders",
                "DetailType": "OrderPaid",
                "Detail": json.dumps(order, default=str),
                "EventBusName": bus,
            }
        ]
    )
    failed = int(response.get("FailedEntryCount") or 0)
    if failed:
        entries = response.get("Entries") or []
        raise RuntimeError(f"EventBridge PutEvents failed ({failed}): {entries}")
