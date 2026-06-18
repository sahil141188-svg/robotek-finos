import type { UserPermissions, UserRole } from "@/types/database";

/** Human-readable labels for each permission key */
export const PERMISSION_META: {
  key: keyof UserPermissions;
  label: string;
  description: string;
  group: string;
}[] = [
  // Dashboard & Reports
  {
    key: "view_dashboard",
    label: "CFO Dashboard",
    description: "View KPI tiles, charts, and financial summaries",
    group: "Dashboard & Reports",
  },
  {
    key: "view_review",
    label: "Review Engine",
    description: "Access weekly, monthly, and quarterly scorecards",
    group: "Dashboard & Reports",
  },
  // Data
  {
    key: "import_data",
    label: "Import / Export Data",
    description: "Upload Excel/PDF files and export reports",
    group: "Data",
  },
  // Compliance
  {
    key: "view_compliance",
    label: "Compliance Calendar",
    description: "View and update GST, TDS, ROC, and other filings",
    group: "Compliance",
  },
  // Operations
  {
    key: "manage_tasks",
    label: "Task Management",
    description: "Create, assign, and complete tasks",
    group: "Operations",
  },
  {
    key: "view_payables",
    label: "Accounts Payable",
    description: "View vendor aging, DPO, and outstanding payments",
    group: "Operations",
  },
  {
    key: "view_receivables",
    label: "Accounts Receivable",
    description: "View customer aging, DSO, and collection log",
    group: "Operations",
  },
  // Banking
  {
    key: "view_banking",
    label: "Bank Statements",
    description: "View bank account balances, cash flow, and transaction analysis",
    group: "Operations",
  },
  // Sales OS
  {
    key: "view_crm",
    label: "Sales OS (View)",
    description: "View leads, sales pipeline, accounts, and activities",
    group: "Sales OS",
  },
  {
    key: "manage_crm",
    label: "Sales OS (Manage)",
    description: "Create and edit leads, deals, accounts, and log activities",
    group: "Sales OS",
  },
  // System
  {
    key: "view_alerts",
    label: "Alerts & Notifications",
    description: "Receive in-app alerts and reminders",
    group: "System",
  },
  {
    key: "admin_users",
    label: "Admin Panel",
    description: "Create users, manage roles, and set permissions",
    group: "System",
  },
];

/** Permission groups for rendering checkboxes in sections */
export const PERMISSION_GROUPS = [
  "Dashboard & Reports",
  "Data",
  "Compliance",
  "Operations",
  "Sales OS",
  "System",
];

/** Default permissions per role — applied when creating a new user */
export const DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  ceo: {
    view_dashboard:   true,
    import_data:      true,
    view_compliance:  true,
    manage_tasks:     true,
    view_payables:    true,
    view_receivables: true,
    view_banking:     true,
    view_review:      true,
    view_alerts:      true,
    admin_users:      true,
    view_crm:         true,
    manage_crm:       true,
  },
  cfo: {
    view_dashboard:   true,
    import_data:      true,
    view_compliance:  true,
    manage_tasks:     true,
    view_payables:    true,
    view_receivables: true,
    view_banking:     true,
    view_review:      true,
    view_alerts:      true,
    admin_users:      false,
    view_crm:         true,
    manage_crm:       true,
  },
  accounts: {
    view_dashboard:   true,
    import_data:      true,
    view_compliance:  true,
    manage_tasks:     true,
    view_payables:    true,
    view_receivables: true,
    view_banking:     true,
    view_review:      false,
    view_alerts:      true,
    admin_users:      false,
    view_crm:         true,
    manage_crm:       true,
  },
  // Bug #6 fix: COO role added — operational focus (AP, expenses, banking)
  coo: {
    view_dashboard:   true,
    import_data:      false,
    view_compliance:  true,
    manage_tasks:     true,
    view_payables:    true,
    view_receivables: true,
    view_banking:     true,
    view_review:      false,
    view_alerts:      true,
    admin_users:      false,
    view_crm:         true,
    manage_crm:       true,
  },
  ca: {
    view_dashboard:   true,
    import_data:      false,
    view_compliance:  true,
    manage_tasks:     true,
    view_payables:    false,
    view_receivables: false,
    view_banking:     false,
    view_review:      false,
    view_alerts:      true,
    admin_users:      false,
    view_crm:         false,
    manage_crm:       false,
  },
  designer: {
    view_dashboard:   false,
    import_data:      false,
    view_compliance:  false,
    manage_tasks:     false,
    view_payables:    false,
    view_receivables: false,
    view_banking:     false,
    view_review:      false,
    view_alerts:      false,
    admin_users:      false,
    view_crm:         false,
    manage_crm:       false,
  },
  reviewer: {
    view_dashboard:   false,
    import_data:      false,
    view_compliance:  false,
    manage_tasks:     false,
    view_payables:    false,
    view_receivables: false,
    view_banking:     false,
    view_review:      false,
    view_alerts:      false,
    admin_users:      false,
    view_crm:         false,
    manage_crm:       false,
  },
};

/** Returns true if the user has the given permission */
export function hasPermission(
  permissions: UserPermissions,
  key: keyof UserPermissions
): boolean {
  return permissions?.[key] === true;
}
