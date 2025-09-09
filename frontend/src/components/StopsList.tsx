import type { Stop } from "../types";

type Props = {
  stops?: Stop[];
  onFocus?: (index: number) => void;
};

function colorFor(t: Stop["type"]) {
  switch (t) {
    case "pickup": return "#2563eb";
    case "dropoff": return "#16a34a";
    case "break": return "#f59e0b";
    case "off10": return "#a855f7";
    case "fuel": return "#ef4444";
    default: return "#111827";
  }
}

export default function StopsList({ stops = [], onFocus }: Props) {
  if (!stops.length) return null;

  return (
    <div className="bg-white rounded-2xl p-3 shadow">
      <div className="font-semibold mb-2">Stops & Rests</div>
      <ol className="space-y-2">
        {stops.map((s, i) => (
          <li key={i} className="flex items-center justify-between text-sm">
            <button
              onClick={() => onFocus?.(i)}
              className="flex items-center gap-2 hover:underline"
              title="Centrar en el mapa"
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: colorFor(s.type) }}
              />
              <span className="capitalize">{s.type}</span> — {s.title}
            </button>
            <div className="text-gray-600">
              {s.at ? new Date(s.at).toLocaleString() : ""} · mi {Math.round(s.mile)}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
