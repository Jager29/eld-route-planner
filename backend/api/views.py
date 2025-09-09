# backend/api/views.py
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from datetime import datetime, timedelta, timezone
from typing import Any, Sequence, Optional

from .routing.ors import geocode, directions, OrsError
from .hos_engine.scheduler import plan_hos
from .logs.generator import to_paperlog_payload
from .utils.geo import coord_along_line 

MI_PER_M = 0.000621371
HOUR = 3600



def _parse_iso(s: Optional[str]) -> datetime:
    """Convierte ISO con o sin 'Z' a datetime UTC."""
    if not s:
        return datetime.now(timezone.utc)
    return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)

def _to_lnglat(val: Any) -> Sequence[float]:
    """
    Normaliza un valor a [lng, lat].
    Acepta:
      - [lng, lat] o (lng, lat)
      - [lat, lng] (detectado por rangos) -> se invierte
      - dict con claves {lng|lon|longitude} y {lat|latitude}
    """
    if isinstance(val, (list, tuple)) and len(val) >= 2:
        a, b = float(val[0]), float(val[1])
        if -180 <= a <= 180 and -90 <= b <= 90:
            return [a, b]
        if -90 <= a <= 90 and -180 <= b <= 180:
            return [b, a]
        return [a, b]

    if isinstance(val, dict):
        lng = val.get("lng") or val.get("lon") or val.get("longitude")
        lat = val.get("lat") or val.get("latitude")
        if lng is not None and lat is not None:
            return [float(lng), float(lat)]

    raise ValueError(f"Invalid coordinate from geocode(): {val!r}")

_norm_lnglat = _to_lnglat


def build_stops(geometry, hos, pickup_ll, dropoff_ll, total_miles):
    """
    Genera paradas: pickup, breaks ~30min, off-duty 10h, fuel cada 1000mi, dropoff.
    Devuelve lista siempre aunque hos venga vacío.
    """
    coords = (geometry or {}).get("coordinates") or []
    logs_by_day = (hos or {}).get("logsByDay", {}) or {}
    totals = (hos or {}).get("totals", {}) or {}

    driving_h = float(totals.get("driving_h") or 0.0)
    mph = (total_miles / driving_h) if driving_h > 0 else 50.0 

    segs = []
    for day in sorted(logs_by_day.keys()):
        s = (logs_by_day[day] or {}).get("segments", []) or []
        segs.extend(s)

    out = []

    out.append({
        "type": "pickup",
        "title": "Pickup",
        "at": segs[0]["start"] if segs else None,
        "mile": 0,
        "coord": pickup_ll if pickup_ll else (coords[0] if coords else [0, 0]),
        "duration_min": 60,
    })

    driven_h = 0.0
    trip_start = _parse_iso(segs[0]["start"]) if segs else datetime.now(timezone.utc)

    for s in segs:
        status = s.get("status")
        start = _parse_iso(s.get("start"))
        end = _parse_iso(s.get("end"))
        dur_h = max(0.0, (end - start).total_seconds() / 3600.0)
        dur_min = int(dur_h * 60)

        if status == "Driving":
            driven_h += dur_h
            continue

        reason, title = None, None
        if status in ("OffDuty", "Sleeper") and dur_min >= 600:
            reason, title = "off10", "10h Off-Duty"
        elif status in ("OffDuty", "OnDuty", "Sleeper") and 25 <= dur_min <= 45:
            reason, title = "break", "30 min Break"

        if reason:
            mile = min(total_miles, driven_h * mph)
            pos = coord_along_line(coords, mile)
            out.append({
                "type": reason, "title": title, "at": s.get("start"),
                "mile": mile, "coord": pos, "duration_min": dur_min
            })

    fuel_mile = 1000.0
    while fuel_mile < total_miles:
        h_at = fuel_mile / mph
        at = (trip_start + timedelta(hours=h_at)).isoformat()
        pos = coord_along_line(coords, fuel_mile)
        out.append({
            "type": "fuel", "title": "Fuel", "at": at,
            "mile": fuel_mile, "coord": pos, "duration_min": 20
        })
        fuel_mile += 1000.0

    out.append({
        "type": "dropoff",
        "title": "Dropoff",
        "at": segs[-1]["end"] if segs else None,
        "mile": total_miles,
        "coord": dropoff_ll if dropoff_ll else (coords[-1] if coords else [0, 0]),
        "duration_min": 60,
    })

    return out



@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


@api_view(["POST"])
def plan_trip(request):
    body = request.data or {}
    try:
        cur = str(body.get("current", "")).strip()
        pickup = str(body.get("pickup", "")).strip()
        drop = str(body.get("dropoff", "")).strip()
        cycle_used = float(body.get("cycleUsedHours", 0) or 0)

        if not (cur and pickup and drop):
            return Response(
                {"error": "Faltan campos (current, pickup, dropoff)"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cur_ll = _to_lnglat(geocode(cur))
        pk_ll  = _to_lnglat(geocode(pickup))
        dp_ll  = _to_lnglat(geocode(drop))

        d = directions([cur_ll, pk_ll, dp_ll])
        route_m = float(d["distance_m"])
        route_s = float(d["duration_s"])
        geom    = d["geometry"] 

        hos = plan_hos(
            start_time=datetime.now(timezone.utc),
            route_distance_m=route_m,
            route_duration_s=route_s,
            geometry_coords=geom["coordinates"],
            cycle_used_hours=cycle_used,
            include_pickup=True,
            include_dropoff=True,
        )

        route = {
            "distance_miles": round(route_m * MI_PER_M, 2),
            "duration_hours": round(route_s / HOUR, 2),
            "geometry": geom,
        }

        stops = build_stops(
            route["geometry"],
            hos,
            pickup_ll=pk_ll,
            dropoff_ll=dp_ll,
            total_miles=route["distance_miles"],
        )

        return Response({
            "route": route,
            "stops": stops,
            "hos": {
                "segments": hos["segments"],
                "totals": hos["totals"],
                "logsByDay": to_paperlog_payload(hos["logsByDay"]),
            },
        })

    except OrsError as e:
        return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response(
            {"error": f"Server error: {e.__class__.__name__}: {e}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
