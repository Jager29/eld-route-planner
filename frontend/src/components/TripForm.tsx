import { useState } from "react";
type Props = { onSubmit: (v:{current:string;pickup:string;dropoff:string;cycleUsedHours:number})=>void };

export default function TripForm({ onSubmit }: Props) {
  const [current, setCurrent] = useState("Chicago, IL");
  const [pickup, setPickup] = useState("Indianapolis, IN");
  const [dropoff, setDropoff] = useState("Pittsburgh, PA");
  const [cycle, setCycle] = useState(0);

  return (
    <form className="grid gap-2 md:grid-cols-4 bg-white p-3 rounded-2xl shadow"
      onSubmit={(e)=>{ e.preventDefault(); onSubmit({current, pickup, dropoff, cycleUsedHours:Number(cycle)||0}); }}>
      <input className="border p-2 rounded" value={current} onChange={e=>setCurrent(e.target.value)} placeholder="Current" />
      <input className="border p-2 rounded" value={pickup} onChange={e=>setPickup(e.target.value)} placeholder="Pickup" />
      <input className="border p-2 rounded" value={dropoff} onChange={e=>setDropoff(e.target.value)} placeholder="Dropoff" />
      <input className="border p-2 rounded" type="number" min={0} step="0.25" value={cycle} onChange={e=>setCycle(+e.target.value)} placeholder="Cycle used (hrs)" />
      <button className="col-span-full bg-black text-white rounded p-2">Plan Trip</button>
    </form>
  );
}
