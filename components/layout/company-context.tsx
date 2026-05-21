"use client";

/**
 * CompanyContext — tracks which Robotek Group company is currently selected.
 * null = "All Companies" (consolidated view).
 * Selection is persisted in localStorage so it survives page reloads.
 */

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { COMPANIES, getCompany, type Company } from "@/lib/companies-data";

const LS_KEY = "robotek_selected_company";

interface CompanyContextType {
  selectedCompanyId: string | null;       // null = All Companies
  selectedCompany:   Company | null;
  setCompanyId:      (id: string | null) => void;
  companies:         Company[];
}

const CompanyContext = createContext<CompanyContextType>({
  selectedCompanyId: "comp-01",
  selectedCompany:   COMPANIES[0],
  setCompanyId:      () => {},
  companies:         COMPANIES,
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads localStorage once on mount — avoids setState-in-effect
  // and prevents a flash of the default company before the stored value loads.
  // typeof window guard makes this SSR-safe.
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => {
    if (typeof window === "undefined") return "comp-01";
    const stored = localStorage.getItem(LS_KEY);
    if (stored === null) return "comp-01";          // first visit
    return stored === "null" ? null : stored;       // "null" string → All Companies
  });

  function setCompanyId(id: string | null) {
    setSelectedCompanyId(id);
    localStorage.setItem(LS_KEY, id ?? "null");
  }

  const selectedCompany = selectedCompanyId ? (getCompany(selectedCompanyId) ?? null) : null;

  return (
    <CompanyContext.Provider
      value={{ selectedCompanyId, selectedCompany, setCompanyId, companies: COMPANIES }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => useContext(CompanyContext);
