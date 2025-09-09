import type { PlanTripReq, PlanTripResp } from "../types";

export async function planTrip(payload: PlanTripReq): Promise<PlanTripResp> {
  const base = import.meta.env.VITE_API_BASE_URL as string;
  const res = await fetch(`${base}/api/plan-trip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as PlanTripResp;
}
