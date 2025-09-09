import type { LineString } from "geojson";

export type StopType = "pickup" | "dropoff" | "break" | "off10" | "fuel";

export type DutyStatus = "OffDuty" | "Sleeper" | "Driving" | "OnDuty";

export interface Segment {
  status: DutyStatus;
  start: string;
  end: string;
  remark?: string | null;
}

export type Stop = {
  type: StopType;
  title: string;
  at: string | null;
  mile: number;
  coord: [number, number];
  duration_min?: number;
  note?: string;
};

export interface DayLog {
  segments: Segment[];
  totals: { driving: number; onduty: number; off: number };
}
export type LogsByDay = Record<string, DayLog>;

export interface PlanTripReq {
  current: string;
  pickup: string;
  dropoff: string;
  cycleUsedHours: number;
}

export interface PlanTripResp {
  route: {
    distance_miles: number;
    duration_hours: number;
    geometry: LineString;
  };
  stops: Stop[];
  hos: {
    segments: Segment[];
    totals: { driving_h: number; onduty_h: number; off_h: number };
    logsByDay: LogsByDay;
  };
}
