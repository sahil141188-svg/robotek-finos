/**
 * CRM Overview — Module 11.
 *
 * Server component. Top-level health of both sales departments:
 *   • KPI tiles (open leads, open pipeline value, won this month, accounts)
 *   • Pipeline snapshot by stage (links into the Kanban)
 *   • NBD / CRR department cards
 *   • Quick links to leads / pipeline / accounts / activities
 *
 * RULE 5: Indian number format. RULE 1: figures link onward.
 */
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { getCrmOverview } from "@/lib/crm/queries";
import { formatIndian } from "@/lib/format";
import { DEAL_STAGES, DEPARTMENT_LABELS } from "@/lib/crm/types";
import {
  UserPlus, GitBranch, Trophy, Building2, ChevronRight,
  TrendingUp, Repeat, Sparkles, ListChecks,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CrmOverviewPage() {
  const o = await getCrmOverview();

  return (
    <>
      <Header
        title="Sales OS"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Sales OS" }]}
        showImport={false}
      />

      <main className="flex-1 p-6 space-y-6 max-w-6xl">
        {/* ── KPI tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile
            href="/dashboard/sales-os/leads"
            icon={<UserPlus className="w-5 h-5 text-blue-600" />}
            label="Open Leads"
            value={`${o.openLeads}`}
            sub="awaiting conversion"
            className="bg-blue-50 border-blue-200"
          />
          <KpiTile
            href="/dashboard/sales-os/pipeline"
            icon={<GitBranch className="w-5 h-5 text-brand-red" />}
            label="Open Pipeline"
            value={formatIndian(o.openPipelineValue, 0)}
            sub={`${o.openDealsCount} active deals`}
            className="bg-white border-border"
          />
          <KpiTile
            href="/dashboard/sales-os/pipeline"
            icon={<Trophy className="w-5 h-5 text-emerald-600" />}
            label="Won This Month"
            value={formatIndian(o.wonThisMonthValue, 0)}
            sub={`${o.wonThisMonthCount} deals closed`}
            className="bg-emerald-50 border-emerald-200"
          />
          <KpiTile
            href="/dashboard/sales-os/accounts"
            icon={<Building2 className="w-5 h-5 text-purple-600" />}
            label="Accounts"
            value={`${o.totalAccounts}`}
            sub={`${o.crrAccounts} CRR · ${o.nbdAccounts} NBD`}
            className="bg-white border-border"
          />
        </div>

        {/* ── Pipeline snapshot ── */}
        <section className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-brand-red" /> Pipeline by Stage
            </h2>
            <Link href="/dashboard/sales-os/pipeline" className="text-xs text-brand-red hover:underline flex items-center gap-1">
              Open Kanban <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {DEAL_STAGES.map((s) => (
              <Link
                key={s.key}
                href="/dashboard/sales-os/pipeline"
                className={`rounded-lg border border-t-4 ${s.accent} border-border bg-brand-gray-light/40 px-3 py-3 text-center hover:bg-brand-gray-light transition-colors`}
              >
                <div className="text-2xl font-bold text-brand-black">{o.stageCounts[s.key] ?? 0}</div>
                <div className="text-[11px] text-brand-gray-mid mt-0.5">{s.label}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Department cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DeptCard
            icon={<Sparkles className="w-5 h-5 text-blue-600" />}
            tag="NBD"
            title={DEPARTMENT_LABELS.nbd}
            line="Lead Gen → Sales Coordinator → Sales Expert → FSR"
            count={o.nbdAccounts}
            countLabel="prospect/new accounts"
            href="/dashboard/sales-os/leads"
            cta="Manage leads"
          />
          <DeptCard
            icon={<Repeat className="w-5 h-5 text-emerald-600" />}
            tag="CRR"
            title={DEPARTMENT_LABELS.crr}
            line="Sales Coordinator → CRM Manager → Sales Expert"
            count={o.crrAccounts}
            countLabel="retained accounts"
            href="/dashboard/sales-os/accounts"
            cta="View accounts"
          />
        </div>

        {/* ── Quick links ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickLink href="/dashboard/sales-os/leads" icon={<UserPlus className="w-4 h-4" />} label="Leads" />
          <QuickLink href="/dashboard/sales-os/pipeline" icon={<GitBranch className="w-4 h-4" />} label="Pipeline" />
          <QuickLink href="/dashboard/sales-os/accounts" icon={<Building2 className="w-4 h-4" />} label="Accounts" />
          <QuickLink href="/dashboard/sales-os/activities" icon={<ListChecks className="w-4 h-4" />} label="Activities" />
        </div>
      </main>
    </>
  );
}

function KpiTile({ href, icon, label, value, sub, className }: {
  href: string; icon: React.ReactNode; label: string; value: string; sub: string; className: string;
}) {
  return (
    <Link href={href} className={`rounded-xl border p-4 transition-shadow hover:shadow-sm ${className}`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-medium text-brand-gray-mid">{label}</span></div>
      <div className="text-2xl font-bold text-brand-black leading-tight">{value}</div>
      <div className="text-[11px] text-brand-gray-mid mt-0.5">{sub}</div>
    </Link>
  );
}

function DeptCard({ icon, tag, title, line, count, countLabel, href, cta }: {
  icon: React.ReactNode; tag: string; title: string; line: string;
  count: number; countLabel: string; href: string; cta: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] font-bold tracking-wide text-brand-gray-mid bg-brand-gray-light rounded px-1.5 py-0.5">{tag}</span>
      </div>
      <h3 className="text-sm font-semibold text-brand-black">{title}</h3>
      <p className="text-xs text-brand-gray-mid mt-1">{line}</p>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold text-brand-black">{count}</div>
          <div className="text-[11px] text-brand-gray-mid">{countLabel}</div>
        </div>
        <Link href={href} className="text-xs text-brand-red hover:underline flex items-center gap-1">
          {cta} <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-3 text-sm font-medium text-brand-black hover:border-brand-red hover:text-brand-red transition-colors"
    >
      {icon} {label}
    </Link>
  );
}
