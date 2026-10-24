import json

from lareesha import dynamo, identity, stock


def _images(product):
    images = product.get("images") or []
    if isinstance(images, str):
        try:
            images = json.loads(images)
        except json.JSONDecodeError:
            return [images] if images.startswith(("http://", "https://")) else []
    urls = []
    if isinstance(images, list):
        for image in images:
            if isinstance(image, dict) and image.get("url"):
                urls.append(image["url"])
            elif isinstance(image, str):
                urls.append(image)
    return urls


def _serialize(product):
    return {
        "id": product["id"],
        "productCode": product.get("productCode") or "",
        "name": product["name"],
        "description": product.get("description") or "",
        "originalPricePaise": int(product.get("originalPricePaise") or 0),
        "salePricePaise": int(product.get("salePricePaise") or 0),
        "images": _images(product),
        "categoryId": product.get("categoryId"),
        "categoryName": product.get("categoryName"),
        "categorySlug": product.get("categorySlug"),
        "newIn": bool(product.get("newIn")),
        "noOfStock": int(product.get("noOfStock") or 0),
        "availableStock": stock.available_stock(product),
    }


def handler(event, context):
    args = identity.args(event)
    include_new = args.get("includeNewArrivals")
    include_sections = args.get("includeCategorySections")
    if include_new is None:
        include_new = True
    if include_sections is None:
        include_sections = True
    limit = int(args.get("sectionLimit") or 8)
    limit = max(1, min(limit, 8))

    categories = dynamo.scan("CATEGORY_TABLE")
    categories.sort(key=lambda c: (c.get("name") or "").lower())
    category_payload = [
        {
            "id": c["id"],
            "name": c["name"],
            "slug": c["slug"],
            "imageUrl": c.get("imageUrl"),
        }
        for c in categories
    ]

    payload = {"categories": category_payload}

    products = dynamo.scan("PRODUCT_TABLE")
    products.sort(key=lambda item: item.get("createdAtIso") or "", reverse=True)

    if include_new:
        new_products = [
            item
            for item in products
            if item.get("newIn") or item.get("newInKey") == "NEW"
        ]
        payload["newArrivals"] = [_serialize(item) for item in new_products[:limit]]
        payload["newArrivalsCount"] = len(new_products)
    else:
        payload["newArrivals"] = []
        payload["newArrivalsCount"] = 0

    if include_sections:
        sections = []
        for category in categories:
            category_products = [
                item for item in products if item.get("categoryId") == category["id"]
            ]
            if not category_products:
                continue
            sections.append(
                {
                    "category": {
                        "id": category["id"],
                        "name": category["name"],
                        "slug": category["slug"],
                        "imageUrl": category.get("imageUrl"),
                    },
                    "products": [_serialize(item) for item in category_products[:limit]],
                    "productCount": len(category_products),
                }
            )
        payload["categorySections"] = sections
    else:
        payload["categorySections"] = []

    return payload
