from datetime import datetime, timezone
from urllib.parse import urlparse
import uuid

import boto3
from botocore.config import Config

from . import secrets


def _client():
    return boto3.client(
        "s3",
        endpoint_url=secrets.r2_endpoint(),
        aws_access_key_id=secrets.r2_access_key(),
        aws_secret_access_key=secrets.r2_secret_key(),
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def presign_put(filename: str, content_type: str, folder: str = "products") -> dict[str, str]:
    ext = ""
    if "." in filename:
        ext = "." + filename.rsplit(".", 1)[-1].lower()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    key = f"{folder.strip('/')}/{stamp}-{uuid.uuid4().hex}{ext}"
    url = _client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": secrets.r2_bucket(),
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=900,
    )
    public_base = secrets.r2_public_url().rstrip("/")
    return {
        "uploadUrl": url,
        "publicUrl": f"{public_base}/{key}",
        "key": key,
    }


def delete_object(key: str) -> None:
    _client().delete_object(Bucket=secrets.r2_bucket(), Key=key)


def product_image_key(source: str) -> str:
    """Object key under products/. Other folders, including test/, are left alone."""
    path = (source or "").strip()
    if not path:
        return ""
    if path.startswith("http://") or path.startswith("https://"):
        path = urlparse(path).path
    path = path.lstrip("/")
    bucket = "lareesha-v1/"
    if path.startswith(bucket):
        path = path[len(bucket) :]
    if not path.startswith("products/"):
        return ""
    return path


def delete_product_image(source: str) -> None:
    key = product_image_key(source)
    if key:
        delete_object(key)


def get_object_bytes(key: str) -> bytes:
    obj = _client().get_object(Bucket=secrets.r2_bucket(), Key=key)
    return obj["Body"].read()


def put_object_bytes(key: str, body: bytes, content_type: str = "application/json") -> str:
    _client().put_object(
        Bucket=secrets.r2_bucket(),
        Key=key,
        Body=body,
        ContentType=content_type,
    )
    return key


def copy_to_folder(source_key: str, folder: str, source_bucket: str | None = None) -> str:
    """Copy an existing bucket object into folder and return its public URL."""
    source_key = source_key.lstrip("/")
    filename = source_key.rsplit("/", 1)[-1] or "image"
    ext = ""
    if "." in filename:
        ext = "." + filename.rsplit(".", 1)[-1].lower()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    dest_key = f"{folder.strip('/')}/{stamp}-{uuid.uuid4().hex}{ext}"
    bucket = secrets.r2_bucket()
    _client().copy_object(
        Bucket=bucket,
        Key=dest_key,
        CopySource={"Bucket": source_bucket or bucket, "Key": source_key},
    )
    return f"{secrets.r2_public_url().rstrip('/')}/{dest_key}"
