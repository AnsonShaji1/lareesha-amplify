from lareesha import dynamo, identity


def handler(event, context):
    owner = identity.user_sub(event)
    address_id = identity.args(event)["addressId"]
    address = dynamo.get("ADDRESS_TABLE", {"id": address_id})
    if not identity.owns(event, address):
        raise Exception("Address not found")

    for existing in dynamo.query_gsi("ADDRESS_TABLE", "userId", owner):
        dynamo.update(
            "ADDRESS_TABLE",
            {"id": existing["id"]},
            {"isDefault": existing["id"] == address_id},
        )

    return dynamo.get("ADDRESS_TABLE", {"id": address_id})
