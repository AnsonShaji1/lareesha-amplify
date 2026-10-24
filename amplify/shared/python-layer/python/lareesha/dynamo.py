import os
import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from functools import lru_cache

import boto3
from boto3.dynamodb.conditions import Attr, Key

_resource = boto3.resource("dynamodb")
_client = boto3.client("dynamodb")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def now_epoch() -> int:
    return int(time.time())


def iso_from_epoch(epoch: int) -> str:
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def table(name_env: str):
    table_name = os.environ[name_env]
    return _resource.Table(table_name)


def to_item(data: dict[str, Any]) -> dict[str, Any]:
    item: dict[str, Any] = {}
    for key, value in data.items():
        if value is None:
            continue
        if isinstance(value, float):
            item[key] = Decimal(str(value))
        else:
            item[key] = value
    return item


def from_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, dict):
        return {key: from_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [from_value(item) for item in value]
    if isinstance(value, set):
        return [from_value(item) for item in value]
    return value


def from_item(item: dict[str, Any] | None) -> dict[str, Any] | None:
    if not item:
        return None
    return from_value(item)


def put(table_env: str, data: dict[str, Any]) -> dict[str, Any]:
    item = to_item(data)
    now = now_iso()
    item.setdefault("createdAt", now)
    item["updatedAt"] = now
    table(table_env).put_item(Item=item)
    return from_item(item) or {}


def get(table_env: str, key: dict[str, Any]) -> dict[str, Any] | None:
    response = table(table_env).get_item(Key=key)
    return from_item(response.get("Item"))


def delete(table_env: str, key: dict[str, Any]) -> None:
    table(table_env).delete_item(Key=key)


def update(table_env: str, key: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    names = {}
    values = {":updatedAt": now_iso()}
    sets = ["#updatedAt = :updatedAt"]
    names["#updatedAt"] = "updatedAt"
    for i, (field, value) in enumerate(updates.items()):
        alias = f"#f{i}"
        placeholder = f":v{i}"
        names[alias] = field
        values[placeholder] = value if not isinstance(value, float) else Decimal(str(value))
        sets.append(f"{alias} = {placeholder}")
    response = table(table_env).update_item(
        Key=key,
        UpdateExpression="SET " + ", ".join(sets),
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
        ReturnValues="ALL_NEW",
    )
    return from_item(response.get("Attributes")) or {}


def query_gsi(
    table_env: str,
    key_name: str,
    key_value: Any,
    sort_name: str | None = None,
    scan_forward: bool = False,
    limit: int | None = None,
    extra_filter: Attr | None = None,
) -> list[dict[str, Any]]:
    index_name = gsi_name(table_env, key_name, sort_name)
    kwargs: dict[str, Any] = {
        "IndexName": index_name,
        "KeyConditionExpression": Key(key_name).eq(key_value),
        "ScanIndexForward": scan_forward,
    }
    if extra_filter is not None:
        kwargs["FilterExpression"] = extra_filter
    if limit:
        kwargs["Limit"] = limit
    items: list[dict[str, Any]] = []
    last = None
    while True:
        if last:
            kwargs["ExclusiveStartKey"] = last
        response = table(table_env).query(**kwargs)
        items.extend(from_item(i) or {} for i in response.get("Items", []))
        last = response.get("LastEvaluatedKey")
        if not last or (limit and len(items) >= limit):
            break
    return items[:limit] if limit else items


def query_pk(
    table_env: str,
    key_name: str,
    key_value: Any,
) -> list[dict[str, Any]]:
    response = table(table_env).query(KeyConditionExpression=Key(key_name).eq(key_value))
    return [from_item(i) or {} for i in response.get("Items", [])]


def scan(table_env: str, extra_filter: Attr | None = None) -> list[dict[str, Any]]:
    kwargs: dict[str, Any] = {}
    if extra_filter is not None:
        kwargs["FilterExpression"] = extra_filter
    items: list[dict[str, Any]] = []
    last = None
    while True:
        if last:
            kwargs["ExclusiveStartKey"] = last
        response = table(table_env).scan(**kwargs)
        items.extend(from_item(i) or {} for i in response.get("Items", []))
        last = response.get("LastEvaluatedKey")
        if not last:
            break
    return items


@lru_cache(maxsize=64)
def gsi_name(table_env: str, partition: str, sort: str | None = None) -> str:
    table_name = os.environ[table_env]
    description = _client.describe_table(TableName=table_name)
    for gsi in description.get("Table", {}).get("GlobalSecondaryIndexes", []):
        keys = gsi.get("KeySchema") or []
        pk = next((k["AttributeName"] for k in keys if k["KeyType"] == "HASH"), None)
        sk = next((k["AttributeName"] for k in keys if k["KeyType"] == "RANGE"), None)
        if pk == partition and sk == sort:
            return gsi["IndexName"]
    raise RuntimeError(f"No GSI on {table_name} for {partition}/{sort}")
