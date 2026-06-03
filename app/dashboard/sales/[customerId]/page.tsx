/**
 * AI Sales Coordinator — per-customer focus page.
 *
 * The salesperson's playbook for ONE customer: which items to push this month,
 * the target qty (their own history +10%, seasonally scaled), how regular they
 * are, and their churn status. RULE 2: drill-down from the Churn Radar.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { getCustomerDetail } from "@/lib/supabase/sales-queries";
import { formatQty } from "@/lib/format";
import { WhatsAppButton } from "@/components/sales/whatsapp-button";
import { WhatsAppSendButton } from "@/components/sales/whatsapp-send-button";
import { CustomerPhone } from "@/components/sales/customer-phone";
import { CustomerTargetsEditor } from "@/components/sales/customer-targets-editor";
import { seasonalFactor } from "@/lib/sales/seasonality";
import { churnNudgeWithItems, waLink } from "@/lib/sales/whatsapp-templates";
import { ArrowLeft, Star, Clock, Package, AlertTriangle, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function CustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const supabase = await createClient();
  const data = await getCustomerDetail(supabase, customerId);
  if (!data) notFound();

  const { customer, focus, occasional, churn, focusMonthlyTotal, currentMonth, provisionalMonth } = data;

  // active products for the "add item" picker in the editor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prodData } = await (supabase as any).from("sales_products").select("id,name").eq("is_active", true).order("name");
  const activeProducts = (prodData ?? []) as { id: string; name: string }[];
  const factor = seasonalFactor(currentMonth);
  const overdue = churn && churn.overdueRatio >= 1.5;

  return (
    <>
      <Header
        title={customer.name}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sales Coordinator", href: "/dashboard/sales" },
          { label: customer.name },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-6 space-y-6 max-w-5xl">
        <Link href="/dashboard/sales" className="inline-flex items-center gap-1.5 text-xs text-brand-gray-mid hover:text-brand-red">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sales Coordinator
        </Link>

        {/* ── Status banner ── */}
        <div className={`rounded-xl border p-5 flex flex-wrap items-center gap-x-8 gap-y-3 ${overdue ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
          <div className="flex items-center gap-2.5">
            {overdue ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <CheckCircle2 className="w-5 h-5 text-green-600" />}
            <div>
              <p className={`text-sm font-semibold ${overdue ? "text-red-700" : "text-green-700"}`}>
                {overdue ? "Overdue — reach out now" : "On track"}
              </p>
              <p className="text-xs text-brand-gray-mid">
                {churn ? `Usually orders every ~${churn.avgGapDays}d · last order ${churn.daysSince}d ago` : "Not enough order history for a rhythm"}
              </p>
            </div>
          </div>
          <Stat label="Total orders" value={`${customer.total_orders}`} />
          <Stat label="Last order" value={fmtDate(customer.last_order_at)} />
          <Stat label="Segment" value={customer.segment ? customer.segment.toUpperCase() : "—"} />
        </div>

        {/* ── WhatsApp action bar ── */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-4">
          {customer.phone ? (
            <>
              {/* Real send via FinOS's configured WhatsApp API (Maytapi) */}
              <WhatsAppSendButton customerId={customer.id} customerName={customer.name} />
              <span className="text-xs text-brand-gray-mid">
                Sends their regular-items nudge straight from FinOS&apos;s WhatsApp.
              </span>
              <WhatsAppButton
                href={waLink(churnNudgeWithItems(customer.name, focus.map((f) => ({ name: f.productName }))), customer.phone)}
                label="Open in WhatsApp"
                size="sm"
              />
            </>
          ) : (
            <>
              <WhatsAppButton
                href={waLink(churnNudgeWithItems(customer.name, focus.map((f) => ({ name: f.productName }))), null)}
                label="Open in WhatsApp"
              />
              <span className="text-xs text-brand-gray-mid max-w-xs">
                Add a number to send automatically from FinOS — otherwise this opens WhatsApp to pick the contact.
              </span>
            </>
          )}
          <div className="ml-auto">
            <CustomerPhone id={customer.id} phone={customer.phone} />
          </div>
        </div>

        {/* ── Focus items ── */}
        <section className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-brand-yellow fill-brand-yellow" />
              <div>
                <h3 className="text-sm font-semibold text-brand-black">Focus items — push these</h3>
                <p className="text-xs text-brand-gray-mid mt-0.5">Their regulars (bought 3+ months), ordered by value. <Star className="inline w-3 h-3 text-brand-yellow fill-brand-yellow" /> = high-value, push first.</p>
              </div>
            </div>
            <span className="text-xs text-brand-gray-mid">Baseline <strong className="text-brand-black">{formatQty(focusMonthlyTotal)}</strong>/mo</span>
          </div>
          <CustomerTargetsEditor
            customerId={customer.id}
            initialFocus={focus.map((r) => ({ productId: r.productId, productName: r.productName, monthlyTarget: r.monthlyTarget, monthsActive: r.monthsActive, lastQty: r.lastQty, highValue: r.highValue }))}
            products={activeProducts}
            factor={factor}
            monthLabel={MONTHS[currentMonth]}
          />
          {provisionalMonth && (
            <p className="px-5 py-2.5 text-[11px] text-brand-gray-mid border-t border-border">* {MONTHS[currentMonth]} has no historical data yet — goal shown at baseline until the live tab fills it in.</p>
          )}
        </section>

        {/* ── Occasional items ── */}
        {occasional.length > 0 && (
          <section className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-gray-mid" />
              <div>
                <h3 className="text-sm font-semibold text-brand-black">Occasional items</h3>
                <p className="text-xs text-brand-gray-mid mt-0.5">Bought before but not regularly — upsell opportunities ({occasional.length})</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-brand-gray-mid bg-brand-gray-light/50">
                    <th className="text-left font-medium px-5 py-2.5">Item</th>
                    <th className="text-right font-medium px-3 py-2.5">Total bought</th>
                    <th className="text-right font-medium px-3 py-2.5">Months</th>
                    <th className="text-right font-medium px-5 py-2.5">Last order</th>
                  </tr>
                </thead>
                <tbody>
                  {occasional.slice(0, 30).map((r) => (
                    <tr key={r.productId} className="border-t border-border hover:bg-brand-gray-light/40 transition-colors">
                      <td className="px-5 py-2.5 text-brand-black">{r.productName}</td>
                      <td className="px-3 py-2.5 text-right text-brand-gray-mid">{formatQty(r.totalQty)}</td>
                      <td className="px-3 py-2.5 text-right text-brand-gray-mid">{r.monthsActive}</td>
                      <td className="px-5 py-2.5 text-right text-brand-gray-mid">{fmtDate(r.lastOrderedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Clock className="w-3.5 h-3.5 text-brand-gray-mid" />
      <div>
        <p className="text-[10px] uppercase tracking-wide text-brand-gray-mid">{label}</p>
        <p className="text-sm font-semibold text-brand-black">{value}</p>
      </div>
    </div>
  );
}
