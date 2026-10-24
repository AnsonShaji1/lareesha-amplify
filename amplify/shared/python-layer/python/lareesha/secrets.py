import os
from functools import lru_cache

import boto3
from botocore.exceptions import ClientError


_ENV_ALIASES = {
    "r2-account-id": "R2_ACCOUNT_ID",
    "r2-access-key-id": "R2_ACCESS_KEY_ID",
    "r2-secret-access-key": "R2_SECRET_ACCESS_KEY",
    "r2-bucket-name": "R2_BUCKET_NAME",
    "r2-public-url": "R2_PUBLIC_URL",
    "razorpay-key-id": "RAZORPAY_KEY_ID",
    "razorpay-key-secret": "RAZORPAY_KEY_SECRET",
    "razorpay-webhook-secret": "RAZORPAY_WEBHOOK_SECRET",
}


@lru_cache(maxsize=32)
def get_parameter(name: str, decrypt: bool = True) -> str:
    candidates = [
        _ENV_ALIASES.get(name, ""),
        name.replace("/", "_").replace("-", "_").upper(),
    ]
    for key in candidates:
        override = os.environ.get(key) if key else None
        if override:
            return override
    ssm = boto3.client("ssm")
    prefix = os.environ.get("SECRET_PREFIX", "/lareesha")
    path = name if name.startswith("/") else f"{prefix}/{name}"
    try:
        response = ssm.get_parameter(Name=path, WithDecryption=decrypt)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ParameterNotFound":
            raise RuntimeError(
                f"Missing SSM parameter {path}. Create it in ap-south-1, then retry the upload."
            ) from exc
        raise
    return response["Parameter"]["Value"]


def razorpay_key_id() -> str:
    return get_parameter("razorpay-key-id")


def razorpay_key_secret() -> str:
    return get_parameter("razorpay-key-secret")


def razorpay_webhook_secret() -> str:
    return get_parameter("razorpay-webhook-secret")


def r2_account_id() -> str:
    return get_parameter("r2-account-id")


def r2_access_key() -> str:
    return get_parameter("r2-access-key-id")


def r2_secret_key() -> str:
    return get_parameter("r2-secret-access-key")


def r2_bucket() -> str:
    return get_parameter("r2-bucket-name")


def r2_public_url() -> str:
    return get_parameter("r2-public-url")


def r2_endpoint() -> str:
    return f"https://{r2_account_id()}.r2.cloudflarestorage.com"
