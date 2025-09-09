import { useEffect, useMemo, useState } from "react";

type Segment = {
  status: "Driving" | "OnDuty" | "OffDuty" | "Sleeper";
  start: string;
  end: string;
  remark?: string | null;
};
type DayLog = { segments: Segment[]; totals: { driving: number; onduty: number; off: number } };
type Props = { logsByDay?: Record<string, DayLog> };

const ROWS = ["OffDuty", "Sleeper", "Driving", "OnDuty"] as const;

function t2x(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  return ((h + m / 60) / 24) * 800; // ancho 800
}
function yFor(status: typeof ROWS[number]) {
  return 20 + ROWS.indexOf(status) * 50;
}

export default function LogSheet({ logsByDay }: Props) {
  // 1) Siempre llama hooks (usa {} si viene undefined)
  const days = useMemo(() => Object.keys(logsByDay ?? {}).sort(), [logsByDay]);

  const firstWithData = useMemo(() => {
    for (const d of days) {
      if ((logsByDay?.[d]?.segments?.length ?? 0) > 0) return d;
    }
    return days[0] ?? null;
  }, [days, logsByDay]);

  const [dayKey, setDayKey] = useState<string | null>(firstWithData);

  // Si cambia logsByDay (nuevo request), re-selecciona día
  useEffect(() => {
    setDayKey(firstWithData);
  }, [firstWithData]);

  // 2) A partir de aquí puedes cortar el render
  if (!logsByDay || !dayKey) return null;

  const day = logsByDay[dayKey];
  if (!day) return null;

  return (
    <div className="bg-white rounded-2xl p-3 shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Daily Log — {dayKey}</div>
        <div className="flex gap-2">
          {days.map((d) => (
            <button
              key={d}
              onClick={() => setDayKey(d)}
              className={`text-xs px-2 py-1 rounded ${d === dayKey ? "bg-black text-white" : "bg-gray-100"}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {day.segments.length === 0 ? (
        <div className="text-sm text-gray-500">No HOS segments for this day.</div>
      ) : (
        <svg viewBox="0 0 820 230" className="w-full">
          {[...Array(25)].map((_, i) => (
            <line key={i} x1={(i * 800) / 24} y1={10} x2={(i * 800) / 24} y2={210} stroke="#ddd" />
          ))}
          {ROWS.map((r) => <line key={r} x1={0} y1={yFor(r)} x2={800} y2={yFor(r)} stroke="#aaa" />)}
          {ROWS.map((r) => (
            <text key={r} x={805} y={yFor(r) + 4} fontSize="10" textAnchor="end">{r}</text>
          ))}

          {day.segments.map((s, idx) => {
            const x1 = t2x(s.start);
            const x2 = t2x(s.end);
            const y = yFor(s.status);
            const x2Adj = x2 > x1 ? x2 : x1 + 3; // mínimo 3px para que se vea
            return <line key={idx} x1={x1} y1={y} x2={x2Adj} y2={y} stroke="black" strokeWidth={3} />;
          })}
        </svg>
      )}
    </div>
  );
}
