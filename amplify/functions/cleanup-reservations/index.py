from botocore.exceptions import ClientError

from lareesha import dynamo, stock


def handler(event, context):
    order_id = (event or {}).get("orderId") if isinstance(event, dict) else None
    if not order_id:
        return {"ignored": True}

    order = dynamo.get("ORDER_TABLE", {"id": order_id})
    if not order or order.get("paymentStatus") != "pending" or not order.get("stockReserved"):
        return {"skipped": True, "orderId": order_id}

    try:
        dynamo.table("ORDER_TABLE").update_item(
            Key={"id": order_id},
            UpdateExpression=(
                "SET #status = :cancelled, #paymentStatus = :failed, "
                "#stockReserved = :false, #updatedAt = :updatedAt"
            ),
            ConditionExpression="#paymentStatus = :pending AND #stockReserved = :true",
            ExpressionAttributeNames={
                "#status": "status",
                "#paymentStatus": "paymentStatus",
                "#stockReserved": "stockReserved",
                "#updatedAt": "updatedAt",
            },
            ExpressionAttributeValues={
                ":cancelled": "cancelled",
                ":failed": "failed",
                ":pending": "pending",
                ":false": False,
                ":true": True,
                ":updatedAt": dynamo.now_iso(),
            },
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return {"skipped": True, "orderId": order_id}
        raise

    reservations = stock.reservations_for_order(order_id)
    for reservation in reservations:
        dynamo.delete("STOCK_RESERVATION_TABLE", {"id": reservation["id"]})
    return {"cancelled": True, "orderId": order_id, "reservations": len(reservations)}
