"use client";

/**
 * CompanyContext — tracks which Robotek Group company is currently selected.
 * null = "All Companies" (consolidated view).
 * Selection is persisted in localStorage so it survives page reloads.
 *
 * companies[] is now fetched from Supabase by the server (dashboard layout)
 * and passed in as a prop — no DB call from the client side.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Company } from "@/lib/companies-data";

const LS_KEY      = "robotek_selected_company";
const COOKIE_NAME = "selected_company_id";
const COOKIE_MAX  = 60 * 60 * 24 * 365; // 1 year in seconds

/** Write the selected company ID to a cookie so server components can read it. */
function writeCookie(id: string | null) {
  if (typeof document === "undefined") return;
  const val = encodeURIComponent(id ?? "");
  document.cookie = `${COOKIE_NAME}=${val}; path=/; SameSite=Lax; max-age=${COOKIE_MAX}`;
}

interface CompanyContextType {
  selectedCompanyId: string | null;       // null = All Companies
  selectedCompany:   Company | null;
  setCompanyId:      (id: string | null) => void;
  companies:         Company[];
}

const CompanyContext = createContext<CompanyContextType>({
  selectedCompanyId: null,
  selectedCompany:   null,
  setCompanyId:      () => {},
  companies:         [],
});

export function CompanyProvider({
  companies,
  initialCompanyId,
  children,
}: {
  companies:        Company[];
  /** Cookie-based company ID from the server — used as SSR-safe initial state. */
  initialCompanyId: string | null;
  children:         ReactNode;
}) {
  const firstId = companies[0]?.id ?? null;

  // Use `initialCompanyId` (from server cookie) as the starting value so
  // the server-rendered HTML and the first client render are always in sync.
  // This eliminates the CompanySwitcher hydration mismatch.
  // After the first mount, we reconcile with localStorage if they differ.
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    () => {
      // On the server, we always use initialCompanyId (from the request cookie).
      if (typeof window === "undefined") return initialCompanyId ?? firstId;
      // On the client — start with initialCompanyId so first render matches server HTML,
      // then the useEffect below syncs to localStorage if needed.
      return initialCompanyId ?? firstId;
    }
  );

  // After hydration: reconcile with localStorage (user may have a different
  // company stored there if the cookie was stale or missing).
  // Also write the confirmed value back to the cookie so server and client stay in sync.
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored === null) {
      // First visit — write current selection to localStorage + cookie
      localStorage.setItem(LS_KEY, selectedCompanyId ?? "null");
      writeCookie(selectedCompanyId);
    } else {
      // Reconcile: prefer localStorage (last explicit user selection)
      const localId = stored === "null" ? null : stored;
      const validId = companies.find((c) => c.id === localId) ? localId : firstId;
      if (validId !== selectedCompanyId) {
        setSelectedCompanyId(validId);
      }
      writeCookie(validId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once on mount only

  function setCompanyId(id: string | null) {
    setSelectedCompanyId(id);
    localStorage.setItem(LS_KEY, id ?? "null");
    writeCookie(id); // keep cookie in sync for server components
  }

  const selectedCompany = selectedCompanyId
    ? (companies.find((c) => c.id === selectedCompanyId) ?? null)
    : null;

  return (
    <CompanyContext.Provider
      value={{ selectedCompanyId, selectedCompany, setCompanyId, companies }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => useContext(CompanyContext);
