from lareesha import identity, media


def handler(event, context):
    key = identity.args(event)["key"]
    media.delete_object(key)
    return {"deleted": True, "key": key}
