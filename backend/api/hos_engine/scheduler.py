from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any

MI_PER_M = 0.000621371
HOUR = 3600

MAX_DRIVE_HRS = 11.0
DUTY_WINDOW_HRS = 14.0
BREAK_AFTER_DRIVE_HRS = 8.0
BREAK_DUR_HRS = 0.5
OFFDUTY_RESET_HRS = 10.0
FUEL_EVERY_MI = 1000.0
FUEL_DUR_HRS = 0.33
PICKUP_DUR_HRS = 1.0
DROPOFF_DUR_HRS = 1.0
CYCLE_LIMIT_HRS = 70.0
RESTART_HRS = 34.0

@dataclass
class Segment:
    status: str   # OffDuty, Sleeper, Driving, OnDuty
    start: datetime
    end: datetime
    remark: str | None = None

def _hours(s: Segment) -> float:
    return (s.end - s.start).total_seconds() / HOUR

def _seg(s: str, start: datetime, hours: float, remark: str | None=None) -> Segment:
    return Segment(s, start, start + timedelta(hours=hours), remark)

def _group_by_day(segments: List[Segment]) -> Dict[str, Any]:
    days: Dict[str, Any] = {}
    for s in segments:
        cur = s.start
        while cur < s.end:
            day_key = cur.date().isoformat()
            day_end = cur.replace(hour=23, minute=59, second=59, microsecond=0)
            slice_end = min(s.end, day_end)
            part = Segment(s.status, cur, slice_end, s.remark)
            d = days.setdefault(day_key, {"segments": [], "totals": {"driving":0.0,"onduty":0.0,"off":0.0}})
            d["segments"].append({"status": part.status, "start": part.start.isoformat(), "end": part.end.isoformat(), "remark": part.remark})
            if part.status == "Driving": d["totals"]["driving"] += _hours(part)
            elif part.status == "OnDuty": d["totals"]["onduty"] += _hours(part)
            else: d["totals"]["off"] += _hours(part)
            cur = slice_end + timedelta(seconds=1)
    for d in days.values():
        for k in d["totals"]:
            d["totals"][k] = round(d["totals"][k], 2)
    return days

def plan_hos(start_time: datetime, route_distance_m: float, route_duration_s: float,
             geometry_coords: list, cycle_used_hours: float=0.0,
             include_pickup: bool=True, include_dropoff: bool=True) -> Dict[str, Any]:
    drive_hours = route_duration_s / HOUR
    total_mi = route_distance_m * MI_PER_M
    segments: List[Segment] = []
    t = start_time

    if include_pickup:
        seg = _seg("OnDuty", t, PICKUP_DUR_HRS, "Pickup"); segments.append(seg); t = seg.end

    drive_left_in_window = MAX_DRIVE_HRS
    window_left = DUTY_WINDOW_HRS - (PICKUP_DUR_HRS if include_pickup else 0.0)
    cycle_left = max(0.0, CYCLE_LIMIT_HRS - cycle_used_hours)
    since_break = 0.0
    driven = 0.0

    while driven < drive_hours:
        if since_break >= BREAK_AFTER_DRIVE_HRS:
            seg = _seg("OffDuty", t, BREAK_DUR_HRS, "30 min break"); segments.append(seg); t = seg.end
            window_left -= BREAK_DUR_HRS; cycle_left -= BREAK_DUR_HRS; since_break = 0.0
            continue
        if drive_left_in_window <= 0 or window_left <= 0 or cycle_left <= 0:
            reset = RESTART_HRS if cycle_left <= 0 else OFFDUTY_RESET_HRS
            seg = _seg("OffDuty", t, reset, "34h restart" if reset==RESTART_HRS else "Overnight reset")
            segments.append(seg); t = seg.end
            drive_left_in_window = MAX_DRIVE_HRS; window_left = DUTY_WINDOW_HRS; cycle_left = CYCLE_LIMIT_HRS; since_break = 0.0
            continue
        remaining = drive_hours - driven
        block = min(remaining, drive_left_in_window, window_left, cycle_left, BREAK_AFTER_DRIVE_HRS - since_break)
        seg = _seg("Driving", t, block); segments.append(seg); t = seg.end
        driven += block; drive_left_in_window -= block; window_left -= block; cycle_left -= block; since_break += block

    if include_dropoff:
        seg = _seg("OnDuty", t, DROPOFF_DUR_HRS, "Dropoff"); segments.append(seg); t = seg.end

    logs_by_day = _group_by_day(segments)
    return {
        "segments": [{"status": s.status, "start": s.start.isoformat(), "end": s.end.isoformat(), "remark": s.remark} for s in segments],
        "logsByDay": logs_by_day,
        "totals": {
            "driving_h": round(sum(_hours(s) for s in segments if s.status=="Driving"), 2),
            "onduty_h": round(sum(_hours(s) for s in segments if s.status=="OnDuty"), 2),
            "off_h": round(sum(_hours(s) for s in segments if s.status!="Driving" and s.status!="OnDuty"), 2),
        },
    }
