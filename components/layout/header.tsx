"use client";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Upload, Menu } from "lucide-react";
import Link from "next/link";
import { useSidebar } from "./sidebar-context";

interface HeaderProps {
  title:        string;
  breadcrumbs?: { label: string; href?: string }[];
  showImport?:  boolean;
  importModule?: string;
}

/**
 * Top header bar with breadcrumb navigation and contextual Import button.
 * On mobile: shows hamburger button to open the sliding sidebar.
 * RULE 2: Breadcrumbs always visible. RULE 3: Import button on every module.
 */
export function Header({ title, breadcrumbs, showImport = true, importModule }: HeaderProps) {
  const { open } = useSidebar();

  return (
    <header className="min-h-14 border-b border-border bg-white flex items-center justify-between px-4 sm:px-6 gap-3 sticky top-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={open}
          className="lg:hidden shrink-0 p-1.5 rounded-lg text-brand-gray-mid hover:text-brand-black hover:bg-brand-gray-light transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col gap-0.5 min-w-0">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <Breadcrumb className="hidden sm:block">
              <BreadcrumbList className="text-xs">
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard" className="text-brand-gray-mid hover:text-brand-red">
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbs.map((crumb, idx) => (
                  <span key={idx} className="flex items-center gap-1.5">
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {crumb.href ? (
                        <BreadcrumbLink href={crumb.href} className="text-brand-gray-mid hover:text-brand-red">
                          {crumb.label}
                        </BreadcrumbLink>
                      ) : (
                        <span className="text-foreground font-medium truncate max-w-[140px] sm:max-w-none">
                          {crumb.label}
                        </span>
                      )}
                    </BreadcrumbItem>
                  </span>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          )}
          <h1 className="text-base sm:text-lg font-semibold text-brand-black leading-tight truncate">
            {title}
          </h1>
        </div>
      </div>

      {showImport && (
        <Link
          href={`/dashboard/import${importModule ? `?module=${importModule}` : ""}`}
          className="shrink-0 inline-flex items-center gap-1.5 h-8 rounded-lg px-3 text-xs font-medium bg-brand-red hover:bg-brand-maroon text-white transition-colors whitespace-nowrap"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Import / Update Data</span>
          <span className="sm:hidden">Import</span>
        </Link>
      )}
    </header>
  );
}
