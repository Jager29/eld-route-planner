import { useEffect, useRef } from "react";
import maplibregl, { type LngLatLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, LineString, GeoJsonProperties } from "geojson";

type Props = { geometry?: LineString };

export default function MapView({ geometry }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // 1) Estilo público sin key para validar render
    const styleUrl =
      import.meta.env.VITE_MAPTILER_KEY
        ? `https://api.maptiler.com/maps/streets/style.json?key=${import.meta.env.VITE_MAPTILER_KEY}`
        : "https://demotiles.maplibre.org/style.json";

    const center: LngLatLike = [-87.6298, 41.8781];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center,
      zoom: 5,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    // Debug útil
    map.on("load", () => console.log("✅ Map style loaded"));
    map.on("error", (e) => console.error("🛑 Map error:", e.error));

    mapRef.current = map;
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geometry) return;

    const apply = () => {
      const srcId = "route";
      const feat: Feature<LineString, GeoJsonProperties> = {
        type: "Feature",
        geometry,
        properties: {},
      };

      if (map.getSource(srcId)) {
        (map.getSource(srcId) as maplibregl.GeoJSONSource).setData(feat);
      } else {
        map.addSource(srcId, { type: "geojson", data: feat });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: srcId,
          paint: { "line-width": 4 },
        });
      }

      const bounds = new maplibregl.LngLatBounds();
      geometry.coordinates.forEach(([lng, lat]) => bounds.extend([lng, lat]));
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40, duration: 0 });
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [geometry]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[420px] rounded-2xl overflow-hidden shadow bg-gray-200"
    />
  );
}
