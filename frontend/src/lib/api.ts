import type { PlanTripReq, PlanTripResp } from "../types";

const HARDCODED_API = "https://eld-backend-rta0.onrender.com";

const ENV = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
const BASE = (ENV && /^https?:\/\//i.test(ENV) ? ENV : (ENV ? `https://${ENV}` : HARDCODED_API)).replace(/\/+$/, "");

export async function planTrip(payload: PlanTripReq): Promise<PlanTripResp> {
  const url = `${BASE}/api/plan-trip`; 
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt}`);
  }
  return (await res.json()) as PlanTripResp;
}
