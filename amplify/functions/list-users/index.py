import os
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

from lareesha import identity

client = boto3.client("cognito-idp")
CAP = 1000


def handler(event, context):
    if "admin" not in identity.user_groups(event):
        raise Exception("Not authorized")

    pool_id = os.environ["USER_POOL_ID"]
    users = _list_users(pool_id)
    admins = _admin_usernames(pool_id)

    rows = []
    for user in users:
        attrs = _attributes(user)
        given = attrs.get("given_name") or ""
        family = attrs.get("family_name") or ""
        name = " ".join(part for part in (given, family) if part).strip()
        created = user.get("UserCreateDate")
        rows.append(
            {
                "username": user.get("Username") or "",
                "sub": attrs.get("sub") or "",
                "name": name or user.get("Username") or "",
                "email": attrs.get("email") or "",
                "phone": attrs.get("phone_number") or "",
                "status": user.get("UserStatus") or "",
                "group": "admin" if user.get("Username") in admins else "customer",
                "createdAtIso": _iso(created),
            }
        )
    return rows


def _list_users(pool_id: str) -> list[dict]:
    users: list[dict] = []
    token = None
    while len(users) < CAP:
        kwargs = {"UserPoolId": pool_id, "Limit": 60}
        if token:
            kwargs["PaginationToken"] = token
        page = client.list_users(**kwargs)
        users.extend(page.get("Users") or [])
        token = page.get("PaginationToken")
        if not token:
            break
    return users[:CAP]


def _admin_usernames(pool_id: str) -> set[str]:
    names: set[str] = set()
    token = None
    while True:
        kwargs = {"UserPoolId": pool_id, "GroupName": "admin", "Limit": 60}
        if token:
            kwargs["NextToken"] = token
        try:
            page = client.list_users_in_group(**kwargs)
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") == "ResourceNotFoundException":
                return names
            raise
        for user in page.get("Users") or []:
            if user.get("Username"):
                names.add(user["Username"])
        token = page.get("NextToken")
        if not token:
            return names


def _attributes(user: dict) -> dict[str, str]:
    values: dict[str, str] = {}
    for item in user.get("Attributes") or []:
        name = item.get("Name")
        if name:
            values[name] = item.get("Value") or ""
    return values


def _iso(value) -> str:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    return ""
