from . import dynamo


def next_product_code() -> str:
    """Atomically take the next product number. The first code is LX-001."""
    response = dynamo.table("SEQUENCE_TABLE").update_item(
        Key={"name": "product"},
        UpdateExpression="ADD #value :one",
        ExpressionAttributeNames={"#value": "value"},
        ExpressionAttributeValues={":one": 1},
        ReturnValues="UPDATED_NEW",
    )
    number = int(response["Attributes"]["value"])
    return f"LX-{number:03d}"
