from lareesha import dynamo, identity, stock

CAP = 200


def handler(event, context):
    args = identity.args(event)
    raw_ids = args.get("ids") or []
    if isinstance(raw_ids, str):
        raw_ids = [raw_ids]
    seen = []
    for product_id in raw_ids:
        if not product_id or product_id in seen:
            continue
        seen.append(str(product_id))
        if len(seen) >= CAP:
            break

    rows = []
    for product_id in seen:
        product = dynamo.get("PRODUCT_TABLE", {"id": product_id})
        available = stock.available_stock(product) if product else 0
        rows.append({"id": product_id, "availableStock": available})
    return rows
