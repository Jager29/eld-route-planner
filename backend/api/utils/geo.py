
from math import radians, cos, sin, asin, sqrt

EARTH_MI = 3958.7613

def haversine_mi(a, b):
    """a, b: [lng, lat]"""
    lon1, lat1 = a; lon2, lat2 = b
    dlon = radians(lon2 - lon1)
    dlat = radians(lat2 - lat1)
    s = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
    return 2 * EARTH_MI * asin(sqrt(s))

def coord_along_line(coords, target_miles):
    """
    Devuelve el [lng, lat] en la polyline 'coords' a 'target_miles'
    desde el inicio. Si se pasa, devuelve el último punto.
    """
    if not coords:
        return [0, 0]
    if target_miles <= 0:
        return coords[0]
    acc = 0.0
    for i in range(1, len(coords)):
        seg = haversine_mi(coords[i-1], coords[i])
        if acc + seg >= target_miles and seg > 0:
            t = (target_miles - acc) / seg
            lon = coords[i-1][0] + (coords[i][0] - coords[i-1][0]) * t
            lat = coords[i-1][1] + (coords[i][1] - coords[i-1][1]) * t
            return [lon, lat]
        acc += seg
    return coords[-1]
