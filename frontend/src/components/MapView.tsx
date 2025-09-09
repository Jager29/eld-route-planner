import { useEffect, useRef } from "react";
import maplibregl, { type LngLatLike, type Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, LineString, GeoJsonProperties } from "geojson";
import type { Stop } from "../types";

type Props = {
    geometry?: LineString;
    stops?: Stop[];
    focusIndex?: number | null;
    onMarkerClick?: (index: number) => void;
};

const COLORS: Record<Stop["type"], string> = {
    pickup: "#2563eb",
    dropoff: "#16a34a",
    break: "#f59e0b",
    off10: "#a855f7",
    fuel: "#ef4444",
};

function makeMarkerEl(color: string) {
    const el = document.createElement("div");
    el.style.width = "18px";
    el.style.height = "18px";
    el.style.borderRadius = "9999px";
    el.style.background = color;
    el.style.border = "2px solid white";
    el.style.boxShadow = "0 0 0 1px rgba(0,0,0,.2)";
    return el;
}

type MapErrorEvent = { error?: { status?: number; message?: string } };

function toLngLat(value: unknown): [number, number] | null {
    if (Array.isArray(value) && value.length >= 2) {
        const a = Number(value[0]);
        const b = Number(value[1]);
        if (Number.isFinite(a) && Number.isFinite(b)) {
            if (a >= -180 && a <= 180 && b >= -90 && b <= 90) return [a, b];
            if (a >= -90 && a <= 90 && b >= -180 && b <= 180) return [b, a];
        }
    } else if (value && typeof value === "object") {
        const v = value as Record<string, unknown>;
        const lng = v.lng ?? v.lon ?? v.longitude;
        const lat = v.lat ?? v.latitude;
        if (lng != null && lat != null) {
            const L = Number(lng);
            const A = Number(lat);
            if (Number.isFinite(L) && Number.isFinite(A)) return [L, A];
        }
    }
    return null;
}

function isZeroZero(c: [number, number]) {
    return c[0] === 0 && c[1] === 0;
}

export default function MapView({ geometry, stops = [], focusIndex, onMarkerClick }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Map | null>(null);

    const lastGeomRef = useRef<LineString | undefined>(undefined);
    const lastStopsRef = useRef<Stop[]>([]);
    const markersRef = useRef<maplibregl.Marker[]>([]);


    const lineStart = () =>
        (geometry?.coordinates?.[0] as [number, number] | undefined) ?? undefined;
    const lineEnd = () =>
        (geometry?.coordinates?.[geometry.coordinates.length - 1] as [number, number] | undefined) ??
        undefined;

    function getStopCoord(s: Stop): unknown {
        return (s as unknown as { coord?: unknown }).coord;
    }

    function normalizedCoord(s: Stop): [number, number] | undefined {
        const c = toLngLat(getStopCoord(s));   
        if (c && !isZeroZero(c)) return c;

        if (s.type === "pickup") return lineStart();
        if (s.type === "dropoff") return lineEnd();
        return undefined;
    }


    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const styleUrl = import.meta.env.VITE_MAPTILER_KEY
            ? `https://api.maptiler.com/maps/streets/style.json?key=${import.meta.env.VITE_MAPTILER_KEY}`
            : "https://demotiles.maplibre.org/style.json";

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: styleUrl,
            center: [-87.6298, 41.8781] as LngLatLike,
            zoom: 5,
        });
        map.addControl(new maplibregl.NavigationControl(), "top-right");

        map.on("error", (e: MapErrorEvent) => {
            const status = Number(e?.error?.status ?? 0);
            if (status === 401 || status === 403) {
                console.warn("Tiles bloqueados. Cambiando a demotiles…");
                map.setStyle("https://demotiles.maplibre.org/style.json");
            }
        });

        map.on("styledata", () => {
            if (lastGeomRef.current) drawRoute(map, lastGeomRef.current);
            if (lastStopsRef.current?.length) drawMarkers(map, lastStopsRef.current);
        });

        mapRef.current = map;
        return () => {
            markersRef.current.forEach((m) => m.remove());
            markersRef.current = [];
            map.remove();
            mapRef.current = null;
        };
    }, []);

    function drawRoute(map: Map, geom: LineString) {
        const sourceId = "route";
        const layerId = "route-line";
        const feat: Feature<LineString, GeoJsonProperties> = {
            type: "Feature",
            geometry: geom,
            properties: {},
        };

        if (map.getSource(sourceId)) {
            (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(feat);
        } else {
            map.addSource(sourceId, { type: "geojson", data: feat });
        }

        if (!map.getLayer(layerId)) {
            map.addLayer({
                id: layerId,
                type: "line",
                source: sourceId,
                paint: { "line-color": "#111", "line-width": 4 },
            });
        }

        const bounds = new maplibregl.LngLatBounds();
        geom.coordinates.forEach(([lng, lat]) => bounds.extend([lng, lat]));
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40, duration: 0 });
    }

    function drawMarkers(map: Map, stopsToDraw: Stop[]) {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        stopsToDraw.forEach((s, i) => {
            const coord = normalizedCoord(s);
            if (!coord) return;

            const el = makeMarkerEl(COLORS[s.type] ?? "#111827");
            const popupHtml = `<b>${s.title}</b><br><small>mi ${Math.round(
                s.mile ?? 0
            )}${s.at ? ` · ${new Date(s.at).toLocaleString()}` : ""}</small>`;

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat(coord)
                .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(popupHtml))
                .addTo(map);

            marker.getElement().addEventListener("click", () => onMarkerClick?.(i));
            markersRef.current.push(marker);
        });
    }

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !geometry) return;
        lastGeomRef.current = geometry;
        if (map.isStyleLoaded()) drawRoute(map, geometry);
        else map.once("load", () => drawRoute(map, geometry));
    }, [geometry]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        lastStopsRef.current = stops ?? [];
        drawMarkers(map, lastStopsRef.current);
    }, [stops]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || focusIndex == null) return;
        const s = lastStopsRef.current[focusIndex];
        const m = markersRef.current[focusIndex];
        if (!s || !m) return;

        const center = normalizedCoord(s);
        if (!center) return;

        map.flyTo({ center, zoom: 9, speed: 1.5 });
        m.togglePopup();
    }, [focusIndex]);

    return (
        <div
            ref={containerRef}
            className="w-full h-[420px] rounded-2xl overflow-hidden shadow bg-gray-200"
        />
    );
}
