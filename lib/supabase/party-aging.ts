/**
 * Party (vendor/customer) aging engine — shared between Payables and Receivables.
 *
 * Given a party's transaction history, computes:
 *   - Current outstanding balance (net of dr_cr direction)
 *   - 4-bucket aging (0-30 / 31-60 / 61-90 / 90+ days)
 *   - Synthetic "open invoice" list using FIFO matching:
 *       payments consume the oldest charge first; whatever's left is shown
 *       per original charge with the days-outstanding for each.
 *   - Last payment date + amount (most recent DR for AP, CR for AR)
 *
 * The aging buckets are computed against TODAY. Charges dated in the future
 * (e.g. opening-balance entries dated 31-May when today is 25-May) clamp to
 * 0 days, putting them in the 0-30 bucket.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type PartyKind = "vendor" | "customer";

/** A single open charge (invoice) remaining after FIFO match. */
export type OpenInvoice = {
  id: string;                     // synthetic id (uses voucher_number + date)
  invoice_no: string;
  invoice_date: string;           // ISO date
  due_date: string;               // ISO date — same as invoice_date for now
  amount: number;                 // rupees, after partial-payment netting
  status: "outstanding" | "partially_paid" | "overdue" | "paid";
  days_outstanding: number;
};

export type PartyAging = {
  party_id: string;
  party_name: string;
  gstin: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  payment_terms_days: number;
  ag0to30: number;
  ag31to60: number;
  ag61to90: number;
  ag90plus: number;
  total: number;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  open_invoices: OpenInvoice[];
};

export type PartyAgingSummary = {
  total: number;
  overdue: number;        // 31+ days
  avg_dpo: number;        // weighted-average days outstanding
  parties: number;        // count of parties with outstanding > 0
  bucket0to30: number;
  bucket31to60: number;
  bucket61to90: number;
  bucket90plus: number;
};

type Txn = {
  ledger_name: string;
  voucher_number: string | null;
  transaction_date: string;
  amount: number;
  dr_cr: "DR" | "CR";
};

/** Days between two ISO yyyy-mm-dd dates (clamped ≥ 0) */
function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00Z").getTime();
  const b = new Date(toIso + "T00:00:00Z").getTime();
  return Math.max(0, Math.floor((b - a) / (24 * 60 * 60 * 1000)));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fetch all parties + their transactions for the given company and build
 * aging snapshots. Returns one PartyAging row per party (even with zero
 * balance — caller decides whether to filter).
 */
export async function buildPartyAging(
  supabase: SupabaseClient<Database>,
  kind: PartyKind,
  companyId: string | null,
): Promise<{ parties: PartyAging[]; summary: PartyAgingSummary }> {
  const table = kind === "vendor" ? "vendors" : "customers";

  // ─ 1. Load all parties for the company ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pq = (supabase as any).from(table).select("*").eq("is_active", true);
  if (companyId) pq = pq.eq("company_id", companyId);
  const { data: parties, error: pErr } = await pq;
  if (pErr) throw pErr;

  type PartyRow = {
    id: string; name: string; gstin: string | null;
    contact_person: string | null; phone: string | null; email: string | null;
    payment_terms_days: number;
  };
  const partyList = (parties || []) as PartyRow[];
  if (partyList.length === 0) {
    return {
      parties: [],
      summary: { total: 0, overdue: 0, avg_dpo: 0, parties: 0,
        bucket0to30: 0, bucket31to60: 0, bucket61to90: 0, bucket90plus: 0 },
    };
  }

  // ─ 2. Load all transactions touching these party ledgers in this FY ──────
  const names = partyList.map((p) => p.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tq = (supabase as any)
    .from("transactions")
    .select("ledger_name, voucher_number, transaction_date, amount, dr_cr")
    .in("ledger_name", names);
  if (companyId) tq = tq.eq("company_id", companyId);

  // Paginate (Supabase default 1000-row cap)
  const allTxns: Txn[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await tq.range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allTxns.push(...(data as Txn[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // ─ 3. Group by ledger_name, then bucket ───────────────────────────────────
  const byName = new Map<string, Txn[]>();
  for (const t of allTxns) {
    const arr = byName.get(t.ledger_name) || [];
    arr.push(t);
    byName.set(t.ledger_name, arr);
  }

  const today = todayIso();
  // For vendor: outstanding = CR - DR (vendor was credited = we owe them)
  // For customer: outstanding = DR - CR (customer was debited = they owe us)
  const sign = (dr_cr: "DR" | "CR"): 1 | -1 =>
    kind === "vendor"
      ? (dr_cr === "CR" ? 1 : -1)
      : (dr_cr === "DR" ? 1 : -1);

  const out: PartyAging[] = [];
  for (const p of partyList) {
    const txns = (byName.get(p.name) || []).slice().sort(
      (a, b) => a.transaction_date.localeCompare(b.transaction_date)
    );

    // ─── Step 1: Authoritative net balance — sum(charges) - sum(payments) ─────
    // This is the ONLY number we trust to decide "how much does this party
    // owe us right now". The FIFO matching below is for displaying aging
    // buckets / which specific invoices are open — but the TOTAL is always
    // net charges minus net payments, capped at zero.
    //
    // Why this matters: the previous version derived `total` from the FIFO
    // queue, which had a subtle bug where overpayment advances stored as
    // negative entries would later be "consumed" by a subsequent payment
    // (remaining -= -X means remaining += X), incorrectly inflating the
    // queue's positive balance. Result: customers with credit balances were
    // dunned for thousands they didn't owe (incident: 2026-06-03 bulk send).
    let chargeSum = 0, payRecvSum = 0;
    let lastPayDate: string | null = null;
    let lastPayAmt: number | null = null;
    for (const t of txns) {
      const amt = Number(t.amount);
      const s = sign(t.dr_cr);
      if (s > 0) chargeSum  += amt;
      else       payRecvSum += amt;
      if (s < 0 && (!lastPayDate || t.transaction_date >= lastPayDate)) {
        lastPayDate = t.transaction_date;
        lastPayAmt = amt;
      }
    }
    const netBalance = chargeSum - payRecvSum;
    const total = Math.max(0, netBalance); // never report a negative as "outstanding"

    // ─── Step 2: FIFO match — for aging buckets only, not for the total ───────
    // Charges go into a queue; payments consume the oldest entries. We cap
    // the produced positive open-balance at `total` (the authoritative net)
    // by pruning the queue's TAIL — the newest unmatched charges — once the
    // queue's positive sum exceeds `total`. This guarantees the bucket sums
    // never overstate, even if the FIFO has matching-order quirks.
    type Open = { date: string; voucher: string | null; amount: number };
    const queue: Open[] = [];
    for (const t of txns) {
      const s = sign(t.dr_cr);
      const amt = Number(t.amount);
      if (s > 0) {
        queue.push({ date: t.transaction_date, voucher: t.voucher_number, amount: amt });
      } else {
        // Consume positive entries only; never the negatives we (used to) push.
        let remaining = amt;
        while (remaining > 0 && queue.length > 0) {
          const head = queue[0];
          if (head.amount <= 0) { queue.shift(); continue; } // defensive — should not occur
          if (head.amount > remaining) { head.amount -= remaining; remaining = 0; }
          else                          { remaining -= head.amount; queue.shift(); }
        }
        // Discard any unconsumed payment. The net balance is the truth; advances
        // are not modelled as queue entries any more (caused incident 2026-06-03).
      }
    }

    // Cap the queue's positive sum at `total` by trimming NEWEST entries
    // (the oldest invoices should be the ones flagged as open).
    let queuePos = 0;
    for (const o of queue) if (o.amount > 0) queuePos += o.amount;
    if (queuePos > total) {
      let overshoot = queuePos - total;
      for (let i = queue.length - 1; i >= 0 && overshoot > 0; i--) {
        if (queue[i].amount <= 0) continue;
        if (queue[i].amount <= overshoot) { overshoot -= queue[i].amount; queue[i].amount = 0; }
        else                              { queue[i].amount -= overshoot; overshoot = 0; }
      }
    }

    // ─── Step 3: Bucket the remaining open invoices ──────────────────────────
    let ag0to30 = 0, ag31to60 = 0, ag61to90 = 0, ag90plus = 0;
    const open_invoices: OpenInvoice[] = [];
    for (const o of queue) {
      if (o.amount <= 0) continue;
      const age = daysBetween(o.date, today);
      if (age <= 30)      ag0to30 += o.amount;
      else if (age <= 60) ag31to60 += o.amount;
      else if (age <= 90) ag61to90 += o.amount;
      else                ag90plus += o.amount;

      open_invoices.push({
        id: `${o.voucher || "n/a"}-${o.date}`,
        invoice_no: o.voucher || "—",
        invoice_date: o.date,
        due_date: o.date,
        amount: o.amount,
        status: age > 30 ? "overdue" : "outstanding",
        days_outstanding: age,
      });
    }
    out.push({
      party_id: p.id, party_name: p.name, gstin: p.gstin,
      contact_person: p.contact_person, phone: p.phone, email: p.email,
      payment_terms_days: p.payment_terms_days,
      ag0to30, ag31to60, ag61to90, ag90plus, total,
      last_payment_date: lastPayDate,
      last_payment_amount: lastPayAmt,
      open_invoices,
    });
  }

  // ─ 4. Summary ─────────────────────────────────────────────────────────────
  let sumTotal = 0, sumOverdue = 0, sumWeightedAge = 0;
  let sum0 = 0, sum1 = 0, sum2 = 0, sum3 = 0;
  let partiesWithBalance = 0;
  for (const r of out) {
    if (r.total > 0) partiesWithBalance++;
    sumTotal += r.total;
    sumOverdue += r.ag31to60 + r.ag61to90 + r.ag90plus;
    sum0 += r.ag0to30; sum1 += r.ag31to60; sum2 += r.ag61to90; sum3 += r.ag90plus;
    for (const inv of r.open_invoices) {
      if (inv.amount > 0) sumWeightedAge += inv.amount * inv.days_outstanding;
    }
  }
  const avgDays = sumTotal > 0 ? Math.round(sumWeightedAge / sumTotal) : 0;

  return {
    parties: out,
    summary: {
      total: sumTotal,
      overdue: sumOverdue,
      avg_dpo: avgDays,
      parties: partiesWithBalance,
      bucket0to30: sum0, bucket31to60: sum1, bucket61to90: sum2, bucket90plus: sum3,
    },
  };
}
