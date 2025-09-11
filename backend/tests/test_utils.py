import pytest
from api.views import _to_lnglat, _is_valid_ll

def test_to_lnglat_array_lnglat():
    assert _to_lnglat([-87.6, 41.9]) == [-87.6, 41.9]

def test_to_lnglat_array_latlng_swaps():
    assert _to_lnglat([41.9, -87.6]) == [-87.6, 41.9]

def test_to_lnglat_dict():
    assert _to_lnglat({"lon": -87.6, "lat": 41.9}) == [-87.6, 41.9]

def test_is_valid_ll_ok():
    assert _is_valid_ll([-87.6, 41.9]) is True

def test_is_valid_ll_rejects_zerozero():
    assert _is_valid_ll([0.0, 0.0]) is False
