import type { UserRole } from "@/types/database";

/** Human-readable role labels — safe to use in client components */
export const ROLE_LABELS: Record<UserRole, string> = {
  ceo: "CEO",
  cfo: "CFO",
  coo: "COO",
  accounts: "Accounts",
  ca: "CA",
};

/** Role-level permissions for conditional UI rendering */
export const ROLE_PERMISSIONS: Record<
  UserRole,
  { canViewAll: boolean; canImport: boolean; canManageUsers: boolean; canViewAudit: boolean }
> = {
  ceo: { canViewAll: true, canImport: true, canManageUsers: true, canViewAudit: true },
  cfo: { canViewAll: true, canImport: true, canManageUsers: false, canViewAudit: true },
  coo: { canViewAll: false, canImport: false, canManageUsers: false, canViewAudit: false },
  accounts: { canViewAll: false, canImport: true, canManageUsers: false, canViewAudit: false },
  ca: { canViewAll: false, canImport: false, canManageUsers: false, canViewAudit: false },
};
