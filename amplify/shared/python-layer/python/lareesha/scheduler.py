import json
import os
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError


def schedule_name(order_id: str) -> str:
    return f"hold-{order_id}"


def create_schedule(order_id: str, expires_at_epoch: int) -> None:
    when = datetime.fromtimestamp(int(expires_at_epoch), tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    boto3.client("scheduler").create_schedule(
        Name=schedule_name(order_id),
        ScheduleExpression=f"at({when})",
        ScheduleExpressionTimezone="UTC",
        FlexibleTimeWindow={"Mode": "OFF"},
        ActionAfterCompletion="DELETE",
        Target={
            "Arn": os.environ["EXPIRE_RESERVATION_LAMBDA_ARN"],
            "RoleArn": os.environ["SCHEDULER_ROLE_ARN"],
            "Input": json.dumps({"orderId": order_id}),
        },
    )


def delete_schedule(order_id: str) -> None:
    if not order_id:
        return
    try:
        boto3.client("scheduler").delete_schedule(Name=schedule_name(order_id))
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code")
        if code in {"ResourceNotFoundException", "ConflictException"}:
            return
        raise
