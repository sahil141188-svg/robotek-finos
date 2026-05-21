"use client";

/**
 * CompanySwitcher — dropdown in the sidebar to switch between the 10 Robotek
 * Group companies or the consolidated "All Companies" view.
 * Renders below the Robotek FinOS logo in the sidebar.
 */

import { useRouter, usePathname } from "next/navigation";
import { useCompany } from "./company-context";
import { ChevronDown, Building2, LayoutGrid } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export function CompanySwitcher() {
  const { selectedCompany, selectedCompanyId, setCompanyId, companies } = useCompany();
  const router   = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleSelect(id: string | null) {
    setOpen(false);
    if (id === null) {
      // "All Companies" → navigate to consolidated dashboard
      setCompanyId(null);
      router.push("/dashboard/consolidated");
    } else {
      setCompanyId(id);
      // If currently on consolidated, navigate back to regular dashboard
      if (pathname.startsWith("/dashboard/consolidated")) {
        router.push("/dashboard");
      }
    }
  }

  const displayLabel = selectedCompanyId === null
    ? "All Companies"
    : (selectedCompany?.short_name ?? "Select Company");

  return (
    <div ref={ref} className="relative px-3 pb-2">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/8 hover:bg-white/15 transition-colors text-left"
      >
        {/* Company avatar dot */}
        <div
          className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
            selectedCompanyId === null
              ? "bg-brand-yellow"
              : (selectedCompany?.color_class ?? "bg-brand-red")
          )}
        >
          {selectedCompanyId === null
            ? <LayoutGrid className="w-3.5 h-3.5 text-brand-black" />
            : <Building2 className="w-3.5 h-3.5 text-white" />
          }
        </div>
        <span className="flex-1 text-xs font-medium text-white truncate">{displayLabel}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-white/50 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-brand-black border border-white/15 rounded-xl shadow-2xl overflow-hidden">
          {/* All Companies */}
          <button
            onClick={() => handleSelect(null)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/10",
              selectedCompanyId === null ? "bg-white/15" : ""
            )}
          >
            <div className="w-6 h-6 rounded-md bg-brand-yellow flex items-center justify-center shrink-0">
              <LayoutGrid className="w-3.5 h-3.5 text-brand-black" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white">All Companies</p>
              <p className="text-[10px] text-white/50">Consolidated view</p>
            </div>
            {selectedCompanyId === null && (
              <div className="w-1.5 h-1.5 rounded-full bg-brand-yellow shrink-0" />
            )}
          </button>

          <div className="h-px bg-white/10 mx-3" />

          {/* Company list — scrollable */}
          <div className="max-h-64 overflow-y-auto">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => handleSelect(company.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/10",
                  selectedCompanyId === company.id ? "bg-white/15" : ""
                )}
              >
                <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0", company.color_class)}>
                  <Building2 className="w-3 h-3 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{company.short_name}</p>
                  {company.status === "dormant" && (
                    <p className="text-[10px] text-white/40">Dormant</p>
                  )}
                </div>
                {selectedCompanyId === company.id && (
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-yellow shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
