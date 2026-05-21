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
  useEffect,
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
  // Default to comp-01 (Robotek India) on first load
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>("comp-01");

  // Sync with localStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    // stored can be a company id or "null" (serialised)
    if (stored !== null) {
      setSelectedCompanyId(stored === "null" ? null : stored);
    }
  }, []);

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
