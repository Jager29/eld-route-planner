import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { planTrip } from "./lib/api";
import TripForm from "./components/TripForm";
import MapView from "./components/MapView";
import StopsList from "./components/StopsList";
import LogSheet from "./components/LogSheet";
import type { PlanTripResp, PlanTripReq, Stop } from "./types";
import type { LineString } from "geojson";

const DEV_FORCE_OFF10 = true; 

function forceOff10(stops: Stop[], geometry?: LineString): Stop[] {
  if (!DEV_FORCE_OFF10) return stops;
  if (!stops || stops.some((s) => s.type === "off10")) return stops;
  if (!geometry?.coordinates?.length) return stops;

  const coords = geometry.coordinates as [number, number][];
  const idx = Math.min(Math.max(Math.round(coords.length * 0.66), 0), coords.length - 1);
  const coord = coords[idx];

  const lastMile = Math.max(0, ...stops.map((s) => Number(s.mile ?? 0)));
  const approxMile = Math.round(lastMile * 0.8);

  const fake: Stop = {
    type: "off10",
    title: "10h Off-Duty",
    at: new Date().toISOString(),
    mile: approxMile,
    coord,
    duration_min: 600,
  };

  const copy = [...stops];
  const dropIdx = copy.findIndex((s) => s.type === "dropoff");
  if (dropIdx >= 0) copy.splice(dropIdx, 0, fake);
  else copy.push(fake);
  return copy;
}

export default function App() {
  const [data, setData] = useState<PlanTripResp | null>(null);

  const mut = useMutation<PlanTripResp, Error, PlanTripReq>({
    mutationFn: planTrip,
    onSuccess: (resp) => setData(resp),
  });

  const stopsForUI: Stop[] = useMemo(() => {
    if (!data) return [];
    return forceOff10(data.stops ?? [], data.route.geometry);
  }, [data]);

  return (
    <div className="min-h-screen bg-gray-100 p-4 space-y-4">
      <h1 className="text-2xl font-bold">ELD Route Planner</h1>

      <TripForm onSubmit={(v) => mut.mutate(v)} />
      {mut.isPending && <div className="p-2">Calculando…</div>}

      {data && (
        <>
          <div className="bg-white p-3 rounded-2xl shadow text-sm">
            Distance: <b>{data.route.distance_miles} mi</b> — Duration:{" "}
            <b>{data.route.duration_hours} h</b>
          </div>

          <MapView
            geometry={data.route.geometry}
            stops={stopsForUI}
          />

          <StopsList
            stops={stopsForUI}
          />

          <LogSheet logsByDay={data.hos.logsByDay} />
        </>
      )}
    </div>
  );
}
