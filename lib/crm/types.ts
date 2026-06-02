/**
 * CRM shared labels, stage config, and small helpers.
 * Safe to import in client components (no server-only code).
 */
import type {
  CrmDepartment,
  CrmTeamRole,
  CrmAccountType,
  CrmAccountStatus,
  CrmLeadStatus,
  CrmDealStage,
  CrmActivityType,
} from "@/types/database";

export const DEPARTMENT_LABELS: Record<CrmDepartment, string> = {
  crr: "Customer Retention & Reorder",
  nbd: "New Business Development",
};

export const DEPARTMENT_SHORT: Record<CrmDepartment, string> = {
  crr: "CRR",
  nbd: "NBD",
};

export const TEAM_ROLE_LABELS: Record<CrmTeamRole, string> = {
  lead_gen:          "Lead Generation",
  sales_coordinator: "Sales Coordinator (Orders)",
  sales_expert:      "Sales Expert (Senior OSR)",
  crm:               "CRM (Account Manager)",
  fsr:               "Field Sales Rep",
  sales_head:        "Sales Head",
};

/** What each role is responsible for — shown as helper text in the UI */
export const TEAM_ROLE_DESC: Record<CrmTeamRole, string> = {
  lead_gen:          "Sources & qualifies new leads",
  sales_coordinator: "Role depends on department — see CRR vs NBD below",
  sales_expert:      "Senior OSR — backs up SC on stuck orders & major issues; does field marketing for Super Stockists: visits new dealers/distributors, opens new territories",
  crm:               "Manages everything: documents, updates, reporting, payment reminders",
  fsr:               "Field visits & on-ground sales",
  sales_head:        "Department head / sales admin",
};

/**
 * The Sales Coordinator does two very different jobs depending on department.
 * Use this to show the right responsibility for an SC.
 */
export const SC_DESC_BY_DEPT: Record<CrmDepartment, string> = {
  crr: "Takes orders only",
  nbd: "Owns the new-customer journey: qualified lead → arrange meeting → negotiation → conversion; ensures smooth journey, timely follow-ups, arranges everything",
};

/** Resolve a team member's responsibility text, accounting for SC-by-department. */
export function roleDescription(role: CrmTeamRole | null, dept: CrmDepartment | null): string {
  if (!role) return "";
  if (role === "sales_coordinator" && dept) return SC_DESC_BY_DEPT[dept];
  return TEAM_ROLE_DESC[role];
}

export const ACCOUNT_TYPE_LABELS: Record<CrmAccountType, string> = {
  super_stockist: "Super Stockist (SS)",
  distributor:    "Distributor",
  dealer:         "Dealer",
  retailer:       "Retailer",
  oem:            "OEM",
  other:          "Other",
};

export const ACCOUNT_STATUS_LABELS: Record<CrmAccountStatus, string> = {
  prospect: "Prospect",
  active:   "Active",
  dormant:  "Dormant",
  lost:     "Lost",
};

export const LEAD_STATUS_LABELS: Record<CrmLeadStatus, string> = {
  new:         "New",
  contacted:   "Contacted",
  qualified:   "Qualified",
  unqualified: "Unqualified",
  converted:   "Converted",
};

export const LEAD_STATUS_COLORS: Record<CrmLeadStatus, string> = {
  new:         "bg-blue-100 text-blue-700",
  contacted:   "bg-amber-100 text-amber-700",
  qualified:   "bg-emerald-100 text-emerald-700",
  unqualified: "bg-gray-200 text-gray-600",
  converted:   "bg-purple-100 text-purple-700",
};

export const ACTIVITY_TYPE_LABELS: Record<CrmActivityType, string> = {
  call:     "Call",
  whatsapp: "WhatsApp",
  meeting:  "Meeting",
  visit:    "Field Visit",
  email:    "Email",
  task:     "Task",
  note:     "Note",
};

/** Ordered pipeline stages with display config. 'won'/'lost' are terminal. */
export const DEAL_STAGES: {
  key: CrmDealStage;
  label: string;
  /** background accent for the kanban column header */
  accent: string;
  terminal?: "won" | "lost";
}[] = [
  { key: "new",         label: "New",         accent: "border-t-blue-400" },
  { key: "qualified",   label: "Qualified",   accent: "border-t-indigo-400" },
  { key: "quoted",      label: "Quoted",      accent: "border-t-amber-400" },
  { key: "negotiation", label: "Negotiation", accent: "border-t-orange-400" },
  { key: "won",         label: "Won",         accent: "border-t-emerald-500", terminal: "won" },
  { key: "lost",        label: "Lost",        accent: "border-t-gray-400", terminal: "lost" },
];

export const DEAL_STAGE_LABELS: Record<CrmDealStage, string> = {
  new:         "New",
  qualified:   "Qualified",
  quoted:      "Quoted",
  negotiation: "Negotiation",
  won:         "Won",
  lost:        "Lost",
};

/** Common lead/deal sources for Robotek's funnel */
export const CRM_SOURCES = [
  "WhatsApp",
  "Phone Call",
  "Exhibition",
  "Referral",
  "Website",
  "Field Visit",
  "Existing Customer",
  "Other",
];
