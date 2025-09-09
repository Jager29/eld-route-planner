import os
import requests
from typing import Tuple, List, Dict, Any

ORS_BASE = "https://api.openrouteservice.org"
ORS_KEY = os.getenv("ORS_API_KEY")

class OrsError(RuntimeError):
    pass

def _parse_latlng(s: str) -> Tuple[float, float] | None:
    if not isinstance(s, str) or "," not in s:
        return None
    a, b = [p.strip() for p in s.split(",", 1)]
    try:
        a, b = float(a), float(b)
    except ValueError:
        return None
    if abs(a) <= 90 and abs(b) <= 180:
        return (a, b)
    if abs(b) <= 90 and abs(a) <= 180:
        return (b, a)
    return None

def geocode(q: str) -> Tuple[float, float]:
    direct = _parse_latlng(q)
    if direct:
        return direct
    if not ORS_KEY:
        raise OrsError("ORS_API_KEY no configurada")
    url = f"{ORS_BASE}/geocode/search"
    r = requests.get(url, params={"api_key": ORS_KEY, "text": q, "size": 1}, timeout=20)
    if r.status_code != 200:
        raise OrsError(f"Geocoding error: {r.status_code} {r.text}")
    data = r.json()
    feats = data.get("features") or []
    if not feats:
        raise OrsError(f"No se encontró geocoding para: {q}")
    lng, lat = feats[0]["geometry"]["coordinates"]
    return (lat, lng)

def directions(coords_latlng: List[Tuple[float, float]]) -> Dict[str, Any]:
    if not ORS_KEY:
        raise OrsError("ORS_API_KEY no configurada")
    coords_lnglat = [[lnglat[1], lnglat[0]] for lnglat in coords_latlng]
    for profile in ("driving-hgv", "driving-car"):
        url = f"{ORS_BASE}/v2/directions/{profile}/geojson"
        body = {"coordinates": coords_lnglat, "instructions": False}
        r = requests.post(url, json=body, headers={"Authorization": ORS_KEY}, timeout=40)
        if r.status_code == 200:
            f = r.json()["features"][0]
            props = f["properties"]
            return {
                "geometry": f["geometry"],
                "distance_m": props["summary"]["distance"],
                "duration_s": props["summary"]["duration"],
            }
    raise OrsError(f"Directions error: {r.status_code} {r.text}")
