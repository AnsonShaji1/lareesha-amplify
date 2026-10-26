import json
from urllib.parse import urlparse

from lareesha import dynamo, identity, media, money
from lareesha.codes import next_product_code


LISTING_KEY = "ALL"
LIVE_IMAGE_BUCKET = "lareesha"


def handler(event, context):
    args = event.get("arguments") or identity.args(event)
    job_id = dynamo.new_id()
    reset_catalog = bool(args.get("resetCatalog"))
    reset_orders = bool(args.get("resetOrders"))
    image_source = (args.get("imageSource") or "test").strip().lower()
    if image_source != "live":
        image_source = "test"
    json_key = args.get("jsonKey")
    json_body = args.get("jsonBody")
    created_by = None
    try:
        created_by = identity.user_sub(event)
    except Exception:
        created_by = "system"

    dynamo.put(
        "CATALOG_SEED_JOB_TABLE",
        {
            "id": job_id,
            "__typename": "CatalogSeedJob",
            "status": "running",
            "resetCatalog": reset_catalog,
            "resetOrders": reset_orders,
            "jsonKey": json_key,
            "totalProducts": 0,
            "processedProducts": 0,
            "createdProducts": 0,
            "createdCategories": 0,
            "createdImages": 0,
            "itemErrors": [],
            "createdBy": created_by,
            "startedAt": dynamo.now_iso(),
            "createdAtIso": dynamo.now_iso(),
        },
    )

    try:
        if json_key:
            raw = media.get_object_bytes(json_key)
            payload = json.loads(raw.decode("utf-8"))
        elif json_body:
            raw = json_body.encode("utf-8") if isinstance(json_body, str) else json_body
            json_key = f"upload_file/{job_id}.json"
            media.put_object_bytes(json_key, raw, "application/json")
            dynamo.update("CATALOG_SEED_JOB_TABLE", {"id": job_id}, {"jsonKey": json_key})
            payload = json.loads(raw.decode("utf-8"))
        else:
            raise Exception("jsonKey or jsonBody is required")

        products = _coerce_products(payload)
        dynamo.update("CATALOG_SEED_JOB_TABLE", {"id": job_id}, {"totalProducts": len(products)})

        if reset_orders:
            _delete_all("ORDER_TABLE")
            _delete_all("PAYMENT_TRANSACTION_TABLE")

        if reset_catalog:
            for product in dynamo.scan("PRODUCT_TABLE"):
                _delete_product_images(product)
            _delete_all("PRODUCT_TABLE")
            _delete_all("CATEGORY_TABLE")
            _delete_all("STOCK_RESERVATION_TABLE")
            _delete_all("CART_ITEM_TABLE")
            _delete_all("WISHLIST_ITEM_TABLE")

        created_products = 0
        created_categories = 0
        created_images = 0
        processed = 0
        errors = []
        known_categories = {c["name"]: c for c in dynamo.scan("CATEGORY_TABLE")}

        for product_data in products:
            name = (product_data.get("name") or "").strip()
            if not name:
                continue
            category_name = product_data.get("category") or product_data.get("category_name") or "Uncategorized"
            sources = product_data.get("images") or []
            images = []
            storage = "live product storage" if image_source == "live" else "test storage"
            for order, source in enumerate(sources):
                url = _copy_image(str(source), "products", image_source)
                if url:
                    images.append({"url": url, "order": order})
                    created_images += 1
                else:
                    errors.append(
                        {
                            "product": name,
                            "image": str(source),
                            "message": f"Could not copy image from {storage}",
                        }
                    )

            if category_name not in known_categories:
                category_image = _copy_image(str(sources[0]), "categories", image_source) if sources else ""
                if sources and not category_image:
                    errors.append(
                        {
                            "product": name,
                            "image": str(sources[0]),
                            "message": f"Could not copy category image from {storage}",
                        }
                    )
                category = _create_category(category_name, category_image or None)
                known_categories[category_name] = category
                created_categories += 1
            else:
                category = known_categories[category_name]

            dynamo.put(
                "PRODUCT_TABLE",
                {
                    "id": dynamo.new_id(),
                    "__typename": "Product",
                    "productCode": next_product_code(),
                    "name": name,
                    "description": str(product_data.get("description") or ""),
                    "originalPricePaise": money.rupees_to_paise(product_data.get("original_price") or 0),
                    "salePricePaise": money.rupees_to_paise(
                        product_data.get("sale_price") or product_data.get("original_price") or 0
                    ),
                    "categoryId": category["id"],
                    "categoryName": category["name"],
                    "categorySlug": category["slug"],
                    "newIn": bool(product_data.get("new_in", False)),
                    "newInKey": "NEW" if product_data.get("new_in") else None,
                    "listingKey": LISTING_KEY,
                    "priceKey": LISTING_KEY,
                    "noOfStock": int(product_data.get("no_of_stock") or 0),
                    "taxPercentageBps": money.tax_bps_from_percent(product_data.get("tax_percentage") or 0),
                    "images": images,
                    "createdAtIso": dynamo.now_iso(),
                },
            )
            created_products += 1
            processed += 1
            dynamo.update(
                "CATALOG_SEED_JOB_TABLE",
                {"id": job_id},
                {
                    "processedProducts": processed,
                    "createdProducts": created_products,
                    "createdCategories": created_categories,
                    "createdImages": created_images,
                },
            )

        dynamo.update(
            "CATALOG_SEED_JOB_TABLE",
            {"id": job_id},
            {
                "status": "completed",
                "completedAt": dynamo.now_iso(),
                "itemErrors": errors,
                "processedProducts": processed,
                "createdProducts": created_products,
                "createdCategories": created_categories,
                "createdImages": created_images,
            },
        )
    except Exception as exc:
        dynamo.update(
            "CATALOG_SEED_JOB_TABLE",
            {"id": job_id},
            {
                "status": "failed",
                "errorMessage": str(exc),
                "completedAt": dynamo.now_iso(),
            },
        )
        raise

    return {"jobId": job_id}


def _coerce_products(payload):
    if isinstance(payload, dict) and "products" in payload:
        payload = payload["products"]
    if not isinstance(payload, list):
        raise Exception("JSON must be a list of products")
    return payload


def _slugify(value: str) -> str:
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug or "category"


def _create_category(name: str, image_url: str | None = None) -> dict:
    slug = _slugify(name)
    existing = dynamo.query_gsi("CATEGORY_TABLE", "slug", slug)
    if existing:
        return existing[0]
    item = {
        "id": dynamo.new_id(),
        "__typename": "Category",
        "name": name,
        "slug": slug,
        "createdAtIso": dynamo.now_iso(),
    }
    if image_url:
        item["imageUrl"] = image_url
    return dynamo.put("CATEGORY_TABLE", item)


def _source_key(source: str, image_source: str = "test") -> str:
    """JSON paths such as /test/33.jpg point at lareesha-v1/test/33.jpg.

    Live seeds use the filename only and read lareesha/products/<filename>.
    """
    path = (source or "").strip()
    if not path:
        return ""
    if path.startswith("http://") or path.startswith("https://"):
        path = urlparse(path).path
    path = path.lstrip("/")
    bucket = "lareesha-v1/"
    if path.startswith(bucket):
        path = path[len(bucket) :]
    if image_source == "live":
        filename = path.rsplit("/", 1)[-1]
        return f"products/{filename}" if filename else ""
    return path


def _copy_image(source: str, folder: str, image_source: str = "test") -> str:
    key = _source_key(source, image_source)
    if not key:
        return ""
    try:
        if image_source == "live":
            return media.copy_to_folder(key, folder, source_bucket=LIVE_IMAGE_BUCKET)
        return media.copy_to_folder(key, folder)
    except Exception:
        return ""


def _image_urls(images) -> list[str]:
    if isinstance(images, str):
        try:
            images = json.loads(images)
        except Exception:
            return []
    if not isinstance(images, list):
        return []
    urls = []
    for item in images:
        if isinstance(item, str) and item:
            urls.append(item)
        elif isinstance(item, dict) and item.get("url"):
            urls.append(str(item["url"]))
    return urls


def _delete_product_images(product: dict) -> None:
    for url in _image_urls(product.get("images")):
        try:
            media.delete_product_image(url)
        except Exception:
            pass


def _delete_all(table_env: str) -> None:
    for item in dynamo.scan(table_env):
        key = {"id": item["id"]} if "id" in item else {"prefix": item["prefix"]}
        dynamo.delete(table_env, key)
