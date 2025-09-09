from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from datetime import datetime, timezone

from .routing.ors import geocode, directions, OrsError
from .hos_engine.scheduler import plan_hos
from .logs.generator import to_paperlog_payload

MI_PER_M = 0.000621371
HOUR = 3600

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
        cycle_used = float(body.get("cycleUsedHours", 0))

        if not (cur and pickup and drop):
            return Response({"error":"Faltan campos (current, pickup, dropoff)"}, status=status.HTTP_400_BAD_REQUEST)

        cur_ll = geocode(cur)
        pk_ll  = geocode(pickup)
        dp_ll  = geocode(drop)

        d = directions([cur_ll, pk_ll, dp_ll])

        route_m = d["distance_m"]; route_s = d["duration_s"]; geom = d["geometry"]; coords = geom["coordinates"]

        hos = plan_hos(
            start_time=datetime.now(timezone.utc),
            route_distance_m=route_m,
            route_duration_s=route_s,
            geometry_coords=coords,
            cycle_used_hours=cycle_used,
            include_pickup=True,
            include_dropoff=True,
        )

        return Response({
            "route": {
                "distance_miles": round(route_m * MI_PER_M, 2),
                "duration_hours": round(route_s / HOUR, 2),
                "geometry": geom,
            },
            "stops": [],
            "hos": {
                "segments": hos["segments"],
                "totals": hos["totals"],
                "logsByDay": to_paperlog_payload(hos["logsByDay"]),
            },
        })

    except OrsError as e:
        return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
    except Exception as e:
        return Response({"error": f"Server error: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
