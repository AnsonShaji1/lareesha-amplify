import random

from lareesha import dynamo, identity, money, razorpay, scheduler, secrets, shipping, stock


def handler(event, context):
    owner = identity.user_sub(event)
    address_id = identity.args(event)["shippingAddressId"]
    address = dynamo.get("ADDRESS_TABLE", {"id": address_id})
    if not identity.owns(event, address):
        raise Exception("Shipping address not found")

    cart = dynamo.query_gsi("CART_ITEM_TABLE", "userId", owner, sort_name="createdAtIso")
    if not cart:
        raise Exception("Cart is empty")

    insufficient = []
    products = {}
    for item in cart:
        product = dynamo.get("PRODUCT_TABLE", {"id": item["productId"]})
        if not product:
            raise Exception(f"Product {item['productId']} not found")
        products[item["productId"]] = product
        available = stock.available_stock(product)
        if available < int(item["quantity"]):
            insufficient.append(
                {
                    "product": product["name"],
                    "requested": int(item["quantity"]),
                    "available": available,
                }
            )
    if insufficient:
        raise Exception(f"Insufficient stock: {insufficient}")

    subtotal = 0
    tax = 0
    order_items = []
    for item in cart:
        product = products[item["productId"]]
        qty = int(item["quantity"])
        price = int(product["salePricePaise"])
        line = price * qty
        subtotal += line
        tax += money.tax_on(line, int(product.get("taxPercentageBps") or 0))
        images = product.get("images") or []
        first_image = None
        if isinstance(images, list) and images:
            first = images[0]
            first_image = first.get("url") if isinstance(first, dict) else first
        order_items.append(
            {
                "productId": product["id"],
                "productName": product["name"],
                "productPricePaise": price,
                "productUrl": f"/product/{product['id']}",
                "productImage": first_image,
                "quantity": qty,
                "lineTotalPaise": line,
            }
        )

    shipping_fee, _zone = shipping.fee_for_address(address, subtotal)
    total = subtotal + shipping_fee + tax
    order_id = dynamo.new_id()
    order_number = f"LL{owner[:6]}{random.randint(100000, 999999)}"
    expires_at = dynamo.now_epoch() + 15 * 60
    expires_iso = dynamo.iso_from_epoch(expires_at)

    razorpay_order = razorpay.create_order(total, order_number)

    scheduler.create_schedule(order_id, expires_at)
    try:
        dynamo.put(
            "ORDER_TABLE",
            {
                "id": order_id,
                "__typename": "Order",
                "owner": identity.owner_field(event),
                "userId": owner,
                "orderNumber": order_number,
                "shippingFullName": address["fullName"],
                "shippingPhone": address["phone"],
                "shippingEmail": address["email"],
                "shippingAddressLine1": address["addressLine1"],
                "shippingAddressLine2": address.get("addressLine2") or "",
                "shippingCity": address["city"],
                "shippingState": address["state"],
                "shippingZipCode": address["zipCode"],
                "shippingCountry": address.get("country") or "India",
                "subtotalPaise": subtotal,
                "shippingPaise": shipping_fee,
                "taxPaise": tax,
                "totalPaise": total,
                "status": "pending",
                "paymentStatus": "pending",
                "razorpayOrderId": razorpay_order["id"],
                "stockReserved": True,
                "reservationExpiresAt": expires_iso,
                "items": order_items,
                "createdAtIso": dynamo.now_iso(),
            },
        )

        for item in cart:
            dynamo.put(
                "STOCK_RESERVATION_TABLE",
                {
                    "id": dynamo.new_id(),
                    "__typename": "StockReservation",
                    "orderId": order_id,
                    "productId": item["productId"],
                    "quantity": int(item["quantity"]),
                    "expiresAtIso": expires_iso,
                    "expiresAtEpoch": expires_at,
                    "createdAtIso": dynamo.now_iso(),
                },
            )
    except Exception:
        scheduler.delete_schedule(order_id)
        for reservation in stock.reservations_for_order(order_id):
            dynamo.delete("STOCK_RESERVATION_TABLE", {"id": reservation["id"]})
        if dynamo.get("ORDER_TABLE", {"id": order_id}):
            dynamo.delete("ORDER_TABLE", {"id": order_id})
        raise

    for item in cart:
        dynamo.delete("CART_ITEM_TABLE", {"id": item["id"]})

    return {
        "id": order_id,
        "orderNumber": order_number,
        "razorpayOrderId": razorpay_order["id"],
        "razorpayKey": secrets.razorpay_key_id(),
        "amountPaise": total,
        "subtotalPaise": subtotal,
        "shippingPaise": shipping_fee,
        "taxPaise": tax,
        "totalPaise": total,
        "reservationExpiresAt": expires_iso,
        "status": "pending",
        "paymentStatus": "pending",
    }
