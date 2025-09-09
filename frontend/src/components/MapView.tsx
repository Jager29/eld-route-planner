import { useEffect, useRef } from "react";
import maplibregl, { type LngLatLike, type Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, LineString, GeoJsonProperties } from "geojson";
import type { Stop } from "../types";

type Props = {
    geometry?: LineString;
    stops?: Stop[];
    focusIndex?: number | null;
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

export default function MapView({ geometry, stops = [], focusIndex }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Map | null>(null);
    const markersRef = useRef<maplibregl.Marker[]>([]);
    const lastGeom = useRef<LineString | undefined>(undefined);
    const lastStops = useRef<Stop[]>([]);

    lastGeom.current = geometry;
    lastStops.current = stops;

    const drawRoute = (map: Map, geom?: LineString) => {
        if (!geom) return;

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
    };

    const drawMarkers = (map: Map, ss: Stop[]) => {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        ss.forEach((s) => {
            const coord = s.coord as [number, number] | undefined;
            if (!coord) return;

            const el = makeMarkerEl(COLORS[s.type] ?? "#111827");
            const popupHtml = `<b>${s.title}</b><br><small>mi ${Math.round(
                s.mile
            )}${s.at ? ` · ${new Date(s.at).toLocaleString()}` : ""}</small>`;

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat(coord)
                .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(popupHtml))
                .addTo(map);

            markersRef.current.push(marker);
        });
    };
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

        type MapErrorPayload = { error?: { status?: number; message?: string } };

        const onError = (e: MapErrorPayload): void => {
            const status = Number(e.error?.status ?? 0);
            const msg = String(e.error?.message ?? "");

            if (status === 401 || status === 403 || /Unauthorized|Forbidden/i.test(msg)) {
                console.warn("Tiles bloqueados. Cambiando a demotiles…");
                map.setStyle("https://demotiles.maplibre.org/style.json");
            }
        };

        const onStyleData = () => {
            drawRoute(map, lastGeom.current);
            drawMarkers(map, lastStops.current);
        };

        map.on("load", onStyleData);
        map.on("styledata", onStyleData);
        map.on("error", onError);

        mapRef.current = map;
        return () => {
            map.off("load", onStyleData);
            map.off("styledata", onStyleData);
            map.off("error", onError);
            markersRef.current.forEach((m) => m.remove());
            markersRef.current = [];
            map.remove();
            mapRef.current = null;
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (map.isStyleLoaded()) drawRoute(map, geometry);
        else map.once("load", () => drawRoute(map, geometry));
    }, [geometry]);

    // Actualizar marcadores cuando cambie stops
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        drawMarkers(map, stops);
    }, [stops]);

    // Centrar/abrir popup del ítem seleccionado
    useEffect(() => {
        const map = mapRef.current;
        if (!map || focusIndex == null) return;
        const s = stops[focusIndex];
        const mk = markersRef.current[focusIndex];
        if (!s?.coord || !mk) return;

        // cierra otros popups y abre el seleccionado
        markersRef.current.forEach((m, i) => {
            if (i !== focusIndex) m.getPopup()?.remove();
        });
        mk.getPopup()?.addTo(map);

        const [lng, lat] = s.coord as [number, number];
        map.flyTo({ center: [lng, lat], zoom: 9, speed: 1.2 });
    }, [focusIndex, stops]);

    return (
        <div
            ref={containerRef}
            className="w-full h-[420px] rounded-2xl overflow-hidden shadow bg-gray-50"
        />
    );
}
