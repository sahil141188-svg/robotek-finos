"use client";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import Link from "next/link";

interface HeaderProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  showImport?: boolean;
  importModule?: string;
}

/**
 * Top header bar with breadcrumb navigation and contextual Import button.
 * RULE 2: Breadcrumbs always visible. RULE 3: Import button on every module.
 */
export function Header({ title, breadcrumbs, showImport = true, importModule }: HeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-white flex items-center justify-between px-6">
      <div className="flex flex-col gap-0.5">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb>
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
                      <span className="text-foreground font-medium">{crumb.label}</span>
                    )}
                  </BreadcrumbItem>
                </span>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}
        <h1 className="text-lg font-semibold text-brand-black leading-tight">{title}</h1>
      </div>

      {showImport && (
        <Link
          href={`/dashboard/import${importModule ? `?module=${importModule}` : ""}`}
          className="inline-flex items-center gap-2 h-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] font-medium bg-brand-red hover:bg-brand-maroon text-white transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          Import / Update Data
        </Link>
      )}
    </header>
  );
}
