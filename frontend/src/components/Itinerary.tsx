import type { Stop } from "../types";

type Props = {
  stops?: Stop[];
  distanceMiles?: number;
  durationHours?: number;
  onFocus?: (index: number) => void; 
};

function toLocal(dt?: string | null) {
  return dt ? new Date(dt).toLocaleString() : "";
}

export default function Itinerary({
  stops = [],
  distanceMiles,
  durationHours,
  onFocus,
}: Props) {
  if (!stops.length) return null;

  const avgMph =
    distanceMiles && durationHours && durationHours > 0
      ? distanceMiles / durationHours
      : undefined;

  const legs = stops.slice(0, -1).map((from, i) => {
    const to = stops[i + 1];
    const miles = Math.max(0, Math.round((to.mile ?? 0) - (from.mile ?? 0)));
    const driveH =
      avgMph && avgMph > 0 ? +(miles / avgMph).toFixed(2) : undefined;
    return {
      iTo: i + 1,
      from,
      to,
      miles,
      driveH,
      arrives: toLocal(to.at),
    };
  });

  function exportCsv() {
    const rows = [
      ["From", "To", "Miles", "Drive(h)", "Arrives (local)"],
      ...legs.map((L) => [
        `${L.from.type} — ${L.from.title}`,
        `${L.to.type} — ${L.to.title}`,
        String(L.miles),
        L.driveH != null ? String(L.driveH) : "",
        L.arrives,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "itinerary.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-white rounded-2xl p-3 shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Itinerary</div>
        <button
          onClick={exportCsv}
          className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-2">From → To</th>
              <th className="py-2 w-24">Miles</th>
              <th className="py-2 w-28">Drive (h)</th>
              <th className="py-2 w-52">Arrives</th>
              <th className="py-2 w-28" />
            </tr>
          </thead>
          <tbody>
            {legs.map((L, idx) => (
              <tr key={idx} className="border-t">
                <td className="py-2">
                  <div className="font-medium">
                    {L.from.type} — {L.from.title}
                  </div>
                  <div className="text-gray-500">
                    → {L.to.type} — {L.to.title}
                  </div>
                </td>
                <td className="py-2">{L.miles}</td>
                <td className="py-2">{L.driveH ?? ""}</td>
                <td className="py-2">{L.arrives}</td>
                <td className="py-2">
                  <button
                    onClick={() => onFocus?.(L.iTo)}
                    className="text-xs px-2 py-1 rounded bg-black text-white"
                  >
                    See on the map
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
