/**
 * Company Cookie — server-side utility.
 *
 * The CompanyContext (client) writes "selected_company_id" to a cookie
 * every time the user switches companies.  Server components and Server
 * Actions read that cookie here to scope all DB queries to the correct
 * subsidiary.
 *
 * Contract:
 *   cookie value = ""        → "All Companies" (no filter → return null)
 *   cookie value = <uuid>    → that company's UUID
 *   cookie absent            → treat as "All Companies" (return null)
 */

import { cookies } from "next/headers";

export const COMPANY_COOKIE = "selected_company_id";

/**
 * Returns the selected company UUID, or null if "All Companies" is selected.
 * Safe to call from any Server Component or Server Action — never throws.
 */
export async function getSelectedCompanyId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COMPANY_COOKIE)?.value;
    if (!raw || raw === "null" || raw === "") return null;
    return decodeURIComponent(raw);
  } catch {
    // cookies() throws outside of a request context (e.g. during build).
    return null;
  }
}
