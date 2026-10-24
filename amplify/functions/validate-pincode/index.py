import json
from urllib.request import urlopen
from urllib.error import URLError, HTTPError

from lareesha import identity


def handler(event, context):
    pincode = (identity.args(event).get("pincode") or "").strip()
    if not pincode.isdigit() or len(pincode) != 6:
        return {"valid": False, "error": "pincode must be a 6-digit number"}

    try:
        with urlopen(f"https://api.postalpincode.in/pincode/{pincode}", timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (URLError, HTTPError, TimeoutError, json.JSONDecodeError):
        return {"valid": False, "error": "Unable to validate pincode right now. Please try again."}

    if not payload or payload[0].get("Status") != "Success":
        return {"valid": False, "error": "Invalid pincode", "pincode": pincode}

    offices = payload[0].get("PostOffice") or []
    normalized = []
    for office in offices:
        normalized.append(
            {
                "name": (office.get("Name") or "").strip(),
                "city": (office.get("District") or "").strip(),
                "state": (office.get("State") or "").strip(),
            }
        )
    return {
        "valid": True,
        "pincode": pincode,
        "cities": sorted({o["city"] for o in normalized if o["city"]}),
        "states": sorted({o["state"] for o in normalized if o["state"]}),
        "postOffices": normalized,
    }
