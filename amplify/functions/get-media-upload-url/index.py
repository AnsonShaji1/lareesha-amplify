from lareesha import identity, media


def handler(event, context):
    args = identity.args(event)
    return media.presign_put(
        args["filename"],
        args["contentType"],
        args.get("folder") or "products",
    )
