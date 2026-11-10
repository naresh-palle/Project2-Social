"""Indian pincode → city/state resolution with town/block preference.

India Post often keeps legacy District labels after reorganizations
(e.g. 502103 still lists District=Medak while Block/HPO=Siddipet).
"""
from __future__ import annotations

import re
from collections import Counter
from typing import Any, Dict, List, Optional

import httpx

# Manual corrections for known India-Post lag / reorganized districts.
PINCODE_OVERRIDES: Dict[str, Dict[str, str]] = {
    "502103": {"city": "Siddipet", "state": "Telangana", "district": "Siddipet"},
    "502114": {"city": "Siddipet", "state": "Telangana", "district": "Siddipet"},
    "502107": {"city": "Gajwel", "state": "Telangana", "district": "Siddipet"},
    "502110": {"city": "Dubbak", "state": "Telangana", "district": "Siddipet"},
    "502001": {"city": "Medak", "state": "Telangana", "district": "Medak"},
    "502220": {"city": "Sangareddy", "state": "Telangana", "district": "Sangareddy"},
}

_LOCALITY_RE = re.compile(
    r"\b(nagar|colony|road|street|busstand|bus stand|market|cross|phase|sector|layout)\b",
    re.I,
)
_HPO_RE = re.compile(r"head\s*post\s*office", re.I)


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _most_common(values: List[Any]) -> str:
    counts = Counter(_clean(v) for v in values if _clean(v))
    if not counts:
        return ""
    return counts.most_common(1)[0][0]


def _looks_like_locality(name: str) -> bool:
    return bool(_LOCALITY_RE.search(_clean(name)))


def resolve_from_post_offices(
    post_offices: Optional[List[Dict[str, Any]]],
    pincode: str = "",
) -> Optional[Dict[str, str]]:
    pin = _clean(pincode)
    if pin in PINCODE_OVERRIDES:
        return {**PINCODE_OVERRIDES[pin], "pincode": pin, "source": "override"}

    offices = [po for po in (post_offices or []) if isinstance(po, dict)]
    if not offices:
        return None

    state = _clean(offices[0].get("State"))
    district = _clean(offices[0].get("District"))
    block = _most_common([po.get("Block") for po in offices])
    pin_from_po = _clean(offices[0].get("Pincode")) or pin

    hpo = next(
        (po for po in offices if _HPO_RE.search(_clean(po.get("BranchType")))),
        None,
    )
    hpo_name = _clean((hpo or {}).get("Name"))

    city = ""
    if hpo_name and not _looks_like_locality(hpo_name):
        city = hpo_name
    if not city and block:
        city = block
    if not city and hpo_name:
        city = hpo_name
    if not city:
        city = _most_common(
            [po.get("Name") for po in offices if not _looks_like_locality(_clean(po.get("Name")))]
        )
    if not city:
        city = district

    if block and district and block.lower() != district.lower():
        if not city or city.lower() == district.lower():
            city = block

    if pin_from_po in PINCODE_OVERRIDES:
        return {**PINCODE_OVERRIDES[pin_from_po], "pincode": pin_from_po, "source": "override"}

    resolved_district = block if (block and block.lower() != district.lower()) else (district or block)
    return {
        "city": city,
        "state": state,
        "district": resolved_district,
        "block": block,
        "pincode": pin_from_po,
        "source": "postalpincode",
    }


async def fetch_pincode_details(pincode: str) -> Dict[str, str]:
    pin = _clean(pincode)
    if not re.fullmatch(r"\d{6}", pin):
        return {"city": "Unknown", "state": "Unknown", "pincode": pin}

    if pin in PINCODE_OVERRIDES:
        return {**PINCODE_OVERRIDES[pin], "pincode": pin, "source": "override"}

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(f"https://api.postalpincode.in/pincode/{pin}")
            data = r.json()
            if data and data[0].get("Status") == "Success":
                resolved = resolve_from_post_offices(data[0].get("PostOffice") or [], pin)
                if resolved and resolved.get("city"):
                    return resolved
        except Exception:
            pass

        try:
            r = await client.get(f"https://api.zippopotam.us/in/{pin}")
            if r.status_code == 200:
                payload = r.json()
                places = payload.get("places") or []
                if places:
                    place = places[0]
                    return {
                        "city": _clean(place.get("place name")),
                        "state": _clean(place.get("state")),
                        "district": _clean(place.get("place name")),
                        "pincode": pin,
                        "source": "zippopotam",
                    }
        except Exception:
            pass

    return {"city": "Unknown", "state": "Unknown", "pincode": pin}
