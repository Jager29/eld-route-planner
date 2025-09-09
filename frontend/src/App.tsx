import { useMutation } from "@tanstack/react-query";
import { planTrip } from "./lib/api";
import TripForm from "./components/TripForm";
import MapView from "./components/MapView";
import LogSheet from "./components/LogSheet";
import { useState } from "react";
import type { PlanTripResp, PlanTripReq } from "./types";

export default function App() {
  const [data, setData] = useState<PlanTripResp | null>(null);

  const mut = useMutation<PlanTripResp, Error, PlanTripReq>({
    mutationFn: planTrip,
    onSuccess: (resp) => setData(resp),
  });

  return (
    <div className="min-h-screen bg-gray-100 p-4 space-y-4">
      <h1 className="text-2xl font-bold">ELD Route Planner</h1>
      <TripForm onSubmit={(v) => mut.mutate(v)} />
      {mut.isPending && <div className="p-2">Calculando…</div>}
      {data && (
        <>
          <div className="bg-white p-3 rounded-2xl shadow text-sm">
            Distance: <b>{data.route.distance_miles} mi</b> — Duration: <b>{data.route.duration_hours} h</b>
          </div>
          <MapView geometry={data.route.geometry} />
          <LogSheet logsByDay={data.hos.logsByDay} />
        </>
      )}
    </div>
  );
}
