import type { UserRole } from "@/types/database";

/** Human-readable role labels — safe to use in client components */
export const ROLE_LABELS: Record<UserRole, string> = {
  ceo:      "CEO",
  cfo:      "CFO",
  coo:      "COO",          // Bug #6 fix: COO role was missing from labels
  accounts: "Accounts",
  ca:       "CA",
};
