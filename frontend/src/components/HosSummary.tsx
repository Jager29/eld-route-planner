import { useEffect, useMemo, useState } from "react";

type Segment = {
    status: "Driving" | "OnDuty" | "OffDuty" | "Sleeper";
    start: string;
    end: string;
};
type DayLog = {
    segments: Segment[];
    totals: { driving: number; onduty: number; off: number };
};
type Props = {
    logsByDay?: Record<string, DayLog>;
};

function h(durMs: number) {
    return +(durMs / 3600000).toFixed(2);
}
function sumH(segments: Segment[], statuses: Segment["status"][]) {
    let ms = 0;
    for (const s of segments) {
        if (statuses.includes(s.status)) {
            ms += new Date(s.end).getTime() - new Date(s.start).getTime();
        }
    }
    return h(ms);
}
function sortSegs(segs: Segment[]) {
    return [...segs].sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
}

function computeDay(segsIn: Segment[]) {
    const segs = sortSegs(segsIn);

    const drivingH = sumH(segs, ["Driving"]);
    const ondutyNonDrivingH = sumH(segs, ["OnDuty"]);
    const offH = sumH(segs, ["OffDuty", "Sleeper"]);

    const firstIdx = segs.findIndex(
        (s) => s.status === "OnDuty" || s.status === "Driving"
    );
    const lastIdx = segs.length - 1;
    let windowH = 0;
    if (firstIdx >= 0 && lastIdx >= 0) {
        const start = new Date(segs[firstIdx].start).getTime();
        const end = new Date(segs[lastIdx].end).getTime();
        windowH = h(Math.max(0, end - start));
    }

    let contDrivingMs = 0;
    let longestStretchMs = 0;
    for (const s of segs) {
        const durMs = new Date(s.end).getTime() - new Date(s.start).getTime();
        if (s.status === "Driving") {
            contDrivingMs += durMs;
            if (contDrivingMs > longestStretchMs) longestStretchMs = contDrivingMs;
        } else if (durMs >= 30 * 60 * 1000) {
            contDrivingMs = 0;
        }
    }
    const contDrivingH = h(contDrivingMs);
    const longestStretchH = h(longestStretchMs);

    const remainTo11 = Math.max(0, +(11 - drivingH).toFixed(2));
    const remainTo14 = Math.max(0, +(14 - windowH).toFixed(2));
    const remainTo8Break = Math.max(0, +(8 - contDrivingH).toFixed(2));

    const flags = {
        over11: drivingH > 11,
        over14: windowH > 14,
        over8NoBreak: longestStretchH > 8,
    };

    return {
        drivingH,
        ondutyNonDrivingH,
        offH,
        windowH,
        contDrivingH,
        longestStretchH,
        remainTo11,
        remainTo14,
        remainTo8Break,
        flags,
    };
}

function Chip({
    kind,
    children,
}: {
    kind: "ok" | "warn" | "bad";
    children: React.ReactNode;
}) {
    const cls =
        kind === "bad"
            ? "bg-red-100 text-red-800"
            : kind === "warn"
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-800";
    return (
        <span className={`text-xs px-2 py-0.5 rounded ${cls} whitespace-nowrap`}>
            {children}
        </span>
    );
}

export default function HosSummary({ logsByDay }: Props) {
    const days = useMemo(
        () => Object.keys(logsByDay ?? {}).sort(),
        [logsByDay]
    );

    const firstWithData = useMemo(() => {
        for (const d of days) {
            if ((logsByDay?.[d]?.segments?.length ?? 0) > 0) return d;
        }
        return days[0] ?? null;
    }, [days, logsByDay]);

    const [dayKey, setDayKey] = useState<string | null>(firstWithData);

    useEffect(() => {
        setDayKey(firstWithData);
    }, [firstWithData]);

    const day = dayKey ? logsByDay?.[dayKey] : undefined;
    const metrics = useMemo(
        () => computeDay(day?.segments ?? []),
        [dayKey, day]
    );

    if (!logsByDay || days.length === 0 || !dayKey || !day) {
        return null;
    }

    return (
        <div className="bg-white rounded-2xl p-3 shadow">
            <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">HOS Summary — {dayKey}</div>
                <div className="flex gap-2">
                    {days.map((d) => (
                        <button
                            key={d}
                            onClick={() => setDayKey(d)}
                            className={`text-xs px-2 py-1 rounded ${d === dayKey ? "bg-black text-white" : "bg-gray-100"
                                }`}
                        >
                            {d}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border">
                    <div className="text-xs text-gray-500 mb-1">Driving today</div>
                    <div className="text-lg font-semibold">{metrics.drivingH} h</div>
                    <div className="text-xs text-gray-600">
                        11 h limit — remaining <b>{metrics.remainTo11} h</b>
                    </div>
                    <div className="mt-2">
                        {metrics.flags.over11 ? (
                            <Chip kind="bad">11 h violation</Chip>
                        ) : metrics.remainTo11 <= 1 ? (
                            <Chip kind="warn">≤ 1 h left</Chip>
                        ) : (
                            <Chip kind="ok">OK</Chip>
                        )}
                    </div>
                </div>

                <div className="p-3 rounded-lg border">
                    <div className="text-xs text-gray-500 mb-1">
                        14 h window (from first OnDuty/Driving)
                    </div>
                    <div className="text-lg font-semibold">{metrics.windowH} h</div>
                    <div className="text-xs text-gray-600">
                        Remaining <b>{metrics.remainTo14} h</b> to 14 h
                    </div>
                    <div className="mt-2">
                        {metrics.flags.over14 ? (
                            <Chip kind="bad">14 h violation</Chip>
                        ) : metrics.remainTo14 <= 1 ? (
                            <Chip kind="warn">Window ≤ 1 h</Chip>
                        ) : (
                            <Chip kind="ok">OK</Chip>
                        )}
                    </div>
                </div>

                <div className="p-3 rounded-lg border">
                    <div className="text-xs text-gray-500 mb-1">
                        Continuous driving (since last ≥ 30 min break)
                    </div>
                    <div className="text-lg font-semibold">{metrics.contDrivingH} h</div>
                    <div className="text-xs text-gray-600">
                        Break in <b>{metrics.remainTo8Break} h</b> (8 h limit)
                    </div>
                    <div className="mt-2">
                        {metrics.flags.over8NoBreak ? (
                            <Chip kind="bad">8 h without break violation</Chip>
                        ) : metrics.remainTo8Break <= 0.5 ? (
                            <Chip kind="warn">Break in ≤ 30 min</Chip>
                        ) : (
                            <Chip kind="ok">OK</Chip>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-3 grid md:grid-cols-3 gap-3 text-sm text-gray-700">
                <div className="p-2 rounded bg-gray-50">
                    <div className="text-xs text-gray-500">OnDuty (non-driving)</div>
                    <div>{metrics.ondutyNonDrivingH} h</div>
                </div>
                <div className="p-2 rounded bg-gray-50">
                    <div className="text-xs text-gray-500">OffDuty + Sleeper</div>
                    <div>{metrics.offH} h</div>
                </div>
                <div className="p-2 rounded bg-gray-50">
                    <div className="text-xs text-gray-500">Longest driving streak</div>
                    <div>{metrics.longestStretchH} h</div>
                </div>
            </div>
        </div>
    );

}
