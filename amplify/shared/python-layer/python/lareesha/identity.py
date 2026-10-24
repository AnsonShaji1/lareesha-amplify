from typing import Any


def user_sub(event: dict[str, Any]) -> str:
    identity = event.get("identity") or {}
    claims = identity.get("claims") or {}
    sub = identity.get("sub") or claims.get("sub")
    if not sub:
        raise ValueError("Not authenticated")
    return str(sub)


def owner_field(event: dict[str, Any]) -> str:
    """Value Amplify writes on owner-protected records (cognito:username by default)."""
    identity = event.get("identity") or {}
    claims = identity.get("claims") or {}
    for value in (
        claims.get("cognito:username"),
        identity.get("username"),
        claims.get("username"),
        identity.get("sub"),
        claims.get("sub"),
    ):
        if value:
            return str(value)
    raise ValueError("Not authenticated")


def caller_ids(event: dict[str, Any]) -> set[str]:
    identity = event.get("identity") or {}
    claims = identity.get("claims") or {}
    values = (
        identity.get("sub"),
        identity.get("username"),
        claims.get("sub"),
        claims.get("username"),
        claims.get("cognito:username"),
    )
    return {str(value) for value in values if value}


def owns(event: dict[str, Any], record: dict[str, Any] | None) -> bool:
    """True when this caller created the record.

    AppSync owner auth stores cognito:username in `owner`. Client writes store
    the Cognito sub in `userId`. Accept either so both shapes match.
    """
    if not record:
        return False
    callers = caller_ids(event)
    if not callers:
        return False
    owners: set[str] = set()
    raw_owner = record.get("owner")
    if isinstance(raw_owner, list):
        owners.update(str(value) for value in raw_owner if value)
    elif raw_owner:
        owners.add(str(raw_owner))
    for value in list(owners):
        if "::" in value:
            owners.update(part for part in value.split("::") if part)
    if owners & callers:
        return True
    user_id = record.get("userId")
    return bool(user_id) and str(user_id) in callers


def user_email(event: dict[str, Any]) -> str:
    identity = event.get("identity") or {}
    claims = identity.get("claims") or {}
    return str(claims.get("email") or identity.get("claims", {}).get("email") or "")


def user_groups(event: dict[str, Any]) -> list[str]:
    identity = event.get("identity") or {}
    claims = identity.get("claims") or {}
    groups = claims.get("cognito:groups") or identity.get("groups") or []
    if isinstance(groups, str):
        return [g.strip() for g in groups.split(",") if g.strip()]
    return list(groups)


def args(event: dict[str, Any]) -> dict[str, Any]:
    return event.get("arguments") or {}
