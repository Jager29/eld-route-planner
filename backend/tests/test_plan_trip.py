import json
from datetime import datetime, timedelta, timezone

import pytest
from django.urls import reverse

# ---- Mocks simples de ORS ----
def _fake_geocode(q):
    # devuelve [lng, lat] “realistas”
    mapping = {
        "Chicago, IL": [-87.6298, 41.8781],
        "Indianapolis, IN": [-86.1581, 39.7684],
        "Pittsburgh, PA": [-79.9959, 40.4406],
    }
    return mapping.get(q, [-87.6298, 41.8781])

def _fake_directions(points):
    # 565.24 mi ~ la demo que usaste
    return {
        "distance_m": 565.24 / 0.000621371,
        "duration_s": 13.43 * 3600,
        "geometry": {
            "type": "LineString",
            "coordinates": points,  # simplificado
        },
    }

@pytest.mark.django_db
def test_plan_trip_happy_path(monkeypatch, client):
    from api import routing
    from api.routing import ors

    monkeypatch.setattr(ors, "geocode", _fake_geocode)
    monkeypatch.setattr(ors, "directions", _fake_directions)

    url = reverse("plan_trip")  # asegúrate que tu urls.py “name” sea plan_trip
    payload = {
        "current": "Chicago, IL",
        "pickup": "Indianapolis, IN",
        "dropoff": "Pittsburgh, PA",
        "cycleUsedHours": 0,
    }
    r = client.post(url, data=json.dumps(payload), content_type="application/json")
    assert r.status_code == 200, r.content
    data = r.json()
    assert "route" in data and "stops" in data and "hos" in data
    # Tiene pickup y dropoff
    types = [s["type"] for s in data["stops"]]
    assert "pickup" in types and "dropoff" in types

@pytest.mark.django_db
def test_plan_trip_missing_fields(client):
    url = reverse("plan_trip")
    r = client.post(url, data=json.dumps({"current": "", "pickup": "", "dropoff": ""}),
                    content_type="application/json")
    assert r.status_code == 400

@pytest.mark.django_db
def test_plan_trip_ors_error(monkeypatch, client):
    from api.routing import ors
    class BOOM(ors.OrsError): pass

    def bad_geocode(q): return [-87.6298, 41.8781]
    def bad_directions(points): raise BOOM("simulated ORS failure")

    monkeypatch.setattr(ors, "geocode", bad_geocode)
    monkeypatch.setattr(ors, "directions", bad_directions)

    url = reverse("plan_trip")
    payload = {
        "current": "Chicago, IL",
        "pickup": "Indianapolis, IN",
        "dropoff": "Pittsburgh, PA",
        "cycleUsedHours": 0,
    }
    r = client.post(url, data=json.dumps(payload), content_type="application/json")
    assert r.status_code in (502, 500)
