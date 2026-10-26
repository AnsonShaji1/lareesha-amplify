from lareesha import dynamo, identity, money, shipping


def handler(event, context):
    owner = identity.user_sub(event)
    address_id = identity.args(event).get("shippingAddressId")
    address = None
    if address_id:
        address = dynamo.get("ADDRESS_TABLE", {"id": address_id})
        if not identity.owns(event, address):
            raise Exception("Shipping address not found")

    cart = dynamo.query_gsi("CART_ITEM_TABLE", "userId", owner, sort_name="createdAtIso")
    if not cart:
        raise Exception("Cart is empty")

    subtotal = 0
    tax = 0
    items = []
    for item in cart:
        product = dynamo.get("PRODUCT_TABLE", {"id": item["productId"]})
        if not product:
            continue
        qty = int(item["quantity"])
        price = int(product["salePricePaise"])
        line = price * qty
        subtotal += line
        tax_bps = int(product.get("taxPercentageBps") or 0)
        tax += money.tax_on(line, tax_bps)
        items.append(
            {
                "productId": product["id"],
                "productName": product["name"],
                "quantity": qty,
                "pricePaise": price,
                "taxPercentageBps": tax_bps,
            }
        )

    shipping_fee, _zone = shipping.fee_for_address(address, subtotal)
    return {
        "subtotalPaise": subtotal,
        "shippingPaise": shipping_fee,
        "taxPaise": tax,
        "totalPaise": subtotal + shipping_fee + tax,
        "shippingPendingAddress": address is None,
        "items": items,
    }
