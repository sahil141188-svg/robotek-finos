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
  type ReactNode,
} from "react";
import type { Company } from "@/lib/companies-data";

const LS_KEY = "robotek_selected_company";

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
  children,
}: {
  companies: Company[];
  children:  ReactNode;
}) {
  const firstId = companies[0]?.id ?? null;

  // Lazy initializer reads localStorage once — avoids setState-in-effect.
  // Validates the stored id against the live company list so stale ids don't break anything.
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => {
    if (typeof window === "undefined") return firstId;
    const stored = localStorage.getItem(LS_KEY);
    if (stored === null)     return firstId;          // first visit
    if (stored === "null")   return null;             // "All Companies"
    // Validate stored id exists in the current list
    return companies.find((c) => c.id === stored) ? stored : firstId;
  });

  function setCompanyId(id: string | null) {
    setSelectedCompanyId(id);
    localStorage.setItem(LS_KEY, id ?? "null");
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
