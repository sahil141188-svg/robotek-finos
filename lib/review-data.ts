/**
 * Review Engine — Types and Utilities
 * Sample scorecard data removed. Upload data via Import to populate.
 */

export type PeriodTab = "weekly" | "monthly" | "quarterly";
export type TrendDir  = "up" | "down" | "neutral";

export type MetricRow = {
  id:             string;
  label:          string;
  value:          string;
  raw:            number;
  change_pct:     number | null;
  change_label:   string;
  good_direction: "up" | "down" | "none";
  drill_href?:    string;
  note?:          string;
};

export type ScorecardSection = {
  title:   string;
  metrics: MetricRow[];
};

export type ScorecardData = {
  period_label:      string;
  as_of:             string;
  health_score:      number;
  health_label:      string;
  health_color:      string;
  executive_summary: string;
  sections:          ScorecardSection[];
};

function getWeekEndDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMonthLabel(): string {
  const today      = new Date();
  const monthNames = ["January","February","March","April","May","June",
                      "July","August","September","October","November","December"];
  const dayOfMonth  = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return `${monthNames[today.getMonth()]} ${today.getFullYear()} (MTD — ${dayOfMonth} of ${daysInMonth} days)`;
}

function getQuarterLabel(): string {
  const today      = new Date();
  const aprilStart = new Date(today.getFullYear(), 3, 1);
  return today < aprilStart ? "Previous Quarter" : "Q1 FY 2026-27 (Apr–Jun, in progress)";
}

// Empty scorecards — sections will populate once real data is imported
const EMPTY_SECTIONS: ScorecardSection[] = [
  {
    title: "No data yet",
    metrics: [
      {
        id: "no_data", label: "Import your data to see scorecard metrics",
        value: "—", raw: 0, change_pct: null, change_label: "",
        good_direction: "none", drill_href: "/dashboard/import",
      },
    ],
  },
];

export const SCORECARD_DATA: Record<PeriodTab, ScorecardData> = {
  weekly: {
    period_label:      `Week ending ${getWeekEndDate()}`,
    as_of:             getWeekEndDate(),
    health_score:      0,
    health_label:      "No Data",
    health_color:      "bg-gray-400",
    executive_summary: "No financial data has been imported yet. Upload your Busy Excel exports or bank statements to generate your weekly scorecard.",
    sections:          EMPTY_SECTIONS,
  },
  monthly: {
    period_label:      getMonthLabel(),
    as_of:             new Date().toISOString().slice(0, 10),
    health_score:      0,
    health_label:      "No Data",
    health_color:      "bg-gray-400",
    executive_summary: "No financial data has been imported yet. Upload your Busy Excel exports or bank statements to generate your monthly scorecard.",
    sections:          EMPTY_SECTIONS,
  },
  quarterly: {
    period_label:      getQuarterLabel(),
    as_of:             new Date().toISOString().slice(0, 10),
    health_score:      0,
    health_label:      "No Data",
    health_color:      "bg-gray-400",
    executive_summary: "No financial data has been imported yet. Upload your Busy Excel exports or bank statements to generate your quarterly scorecard.",
    sections:          EMPTY_SECTIONS,
  },
};

export function trendClass(row: MetricRow): string {
  if (row.change_pct === null || row.change_pct === 0) return "text-brand-gray-mid";
  const improved =
    (row.good_direction === "up"   && row.change_pct > 0) ||
    (row.good_direction === "down" && row.change_pct < 0);
  return improved ? "text-green-600" : "text-red-600";
}

export function trendIcon(row: MetricRow): "up" | "down" | "neutral" {
  if (row.change_pct === null || row.change_pct === 0) return "neutral";
  return row.change_pct > 0 ? "up" : "down";
}
