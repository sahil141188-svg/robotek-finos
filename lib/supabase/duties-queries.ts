/**
 * Imports & Duties aggregator — surfaces statutory & logistics costs
 * that get buried in the generic "expense" view.
 *
 * Categories:
 *   - Custom Duty (Custom Duty Payable / Customs / Import Duty)
 *   - Input GST  (DR to CGST/SGST/IGST — claimable as input credit)
 *   - Output GST (CR to CGST/SGST/IGST — owed to govt)
 *   - Net GST   = Output - Input
 *   - Freight & Cargo (Maersk, ANKITA, Godara, etc. + Clearing /
 *     Transportation / Forwarding ledgers)
 *   - TDS deducted (CR to TDS ledgers — withheld from vendor payments)
 *
 * Returns per-month trend, per-vendor breakdown for logistics, and a
 * combined recent-transactions list.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type DutyCategory = "custom_duty" | "input_gst" | "output_gst" | "freight" | "tds";

export type DutyLine = {
  date: string;
  voucher_number: string | null;
  voucher_type: string;
  ledger_name: string;
  amount: number;
  category: DutyCategory;
};

export type DutiesSummary = {
  /** Current-month totals */
  customDutyMTD: number;
  freightMTD: number;
  inputGstMTD: number;
  outputGstMTD: number;
  netGstMTD: number;
  tdsMTD: number;

  /** Previous-month totals (for vs-last-month chips) */
  customDutyPrev: number;
  freightPrev: number;
  inputGstPrev: number;
  outputGstPrev: number;
  tdsPrev: number;

  /** 6-month trend (oldest → newest) */
  monthly: Array<{
    month: string;
    period: string;
    customDuty: number;
    freight: number;
    inputGst: number;
    outputGst: number;
    netGst: number;
    tds: number;
  }>;

  /** Top logistics vendors (current month) */
  topFreightVendors: Array<{ vendor: string; amount: number }>;

  /** Recent transactions across all 5 categories (latest 50) */
  recent: DutyLine[];
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isCustomDutyLedger(name: string) {
  return /\b(custom duty|customs|import duty|cd payable|bcd\b)\b/i.test(name);
}
function isInputGstLedger(name: string) {
  // Input GST = CGST/SGST/IGST/UTGST that's being DR'd (claimable as ITC)
  return /\b(cgst|sgst|igst|utgst|gst input)\b/i.test(name) && !/output|payable/i.test(name);
}
function isOutputGstLedger(name: string) {
  // Output GST = explicitly "Output" or "GST Payable" OR the SAME tax ledger CR side
  return /\b(gst payable|output gst|output cgst|output sgst|output igst|gst output)\b/i.test(name);
}
function isFreightLedger(name: string) {
  return /\b(freight|cargo|forwarding|clearing|transportation|transport|shipping|cartage|logistics)\b/i.test(name);
}
function isFreightVendor(name: string) {
  // Hard-coded common freight forwarder names — extend as Robotek adds vendors
  return /\b(maersk|godara|ankita|cma cgm|hapag|msc|cevalogistics|dhl|fedex|blue dart|gati|safexpress|allcargo|jeena|aramex)\b/i.test(name);
}
function isTdsLedger(name: string) {
  return /\btds\b/i.test(name);
}

export async function fetchDutiesSummary(
  supabase: SupabaseClient<Database>,
  companyId: string | null,
): Promise<DutiesSummary> {
  const today = new Date();
  const curM   = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const prevD  = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevM  = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, "0")}`;

  type Txn = {
    transaction_date: string; voucher_number: string | null; voucher_type: string;
    ledger_name: string; amount: number; dr_cr: "DR" | "CR";
  };

  // Pull all transactions (paginated)
  const txns: Txn[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any).from("transactions")
      .select("transaction_date, voucher_number, voucher_type, ledger_name, amount, dr_cr");
    if (companyId) q = q.eq("company_id", companyId);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    txns.push(...(data as Txn[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Classify and tally
  const monthMap = new Map<string, { customDuty: number; freight: number; inputGst: number; outputGst: number; tds: number }>();
  const ensure = (m: string) => {
    if (!monthMap.has(m)) monthMap.set(m, { customDuty: 0, freight: 0, inputGst: 0, outputGst: 0, tds: 0 });
    return monthMap.get(m)!;
  };

  const recent: DutyLine[] = [];
  const vendorFreight = new Map<string, number>();

  for (const t of txns) {
    const amt = Number(t.amount);
    const m = t.transaction_date.slice(0, 7);
    let cat: DutyCategory | null = null;

    if (isCustomDutyLedger(t.ledger_name)) {
      ensure(m).customDuty += amt;
      cat = "custom_duty";
    } else if (isOutputGstLedger(t.ledger_name)) {
      // Explicit output ledgers
      ensure(m).outputGst += amt;
      cat = "output_gst";
    } else if (isInputGstLedger(t.ledger_name)) {
      // Generic CGST/SGST/IGST — DR = input credit claimable, CR = output owed
      if (t.dr_cr === "DR") { ensure(m).inputGst  += amt; cat = "input_gst"; }
      else                  { ensure(m).outputGst += amt; cat = "output_gst"; }
    } else if (isFreightLedger(t.ledger_name) || isFreightVendor(t.ledger_name)) {
      // Only Jrnl/Pymt entries — the CR side of a freight-vendor Jrnl creates AP;
      // the DR side is the expense booked. Capture either as freight.
      ensure(m).freight += amt;
      cat = "freight";
      if (m === curM) {
        vendorFreight.set(t.ledger_name, (vendorFreight.get(t.ledger_name) || 0) + amt);
      }
    } else if (isTdsLedger(t.ledger_name)) {
      ensure(m).tds += amt;
      cat = "tds";
    }

    if (cat && recent.length < 200) {
      recent.push({
        date: t.transaction_date,
        voucher_number: t.voucher_number,
        voucher_type: t.voucher_type,
        ledger_name: t.ledger_name,
        amount: amt,
        category: cat,
      });
    }
  }

  const cur  = monthMap.get(curM)  ?? { customDuty: 0, freight: 0, inputGst: 0, outputGst: 0, tds: 0 };
  const prev = monthMap.get(prevM) ?? { customDuty: 0, freight: 0, inputGst: 0, outputGst: 0, tds: 0 };

  // 6-month trend (oldest → newest)
  const monthly: DutiesSummary["monthly"] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const m = monthMap.get(key) ?? { customDuty: 0, freight: 0, inputGst: 0, outputGst: 0, tds: 0 };
    monthly.push({
      month: MONTH_LABELS[d.getMonth()],
      period: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
      customDuty: m.customDuty,
      freight: m.freight,
      inputGst: m.inputGst,
      outputGst: m.outputGst,
      netGst: m.outputGst - m.inputGst,
      tds: m.tds,
    });
  }

  const topFreightVendors = [...vendorFreight.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([vendor, amount]) => ({ vendor, amount }));

  // Sort recent by date desc, cap 50
  recent.sort((a, b) => b.date.localeCompare(a.date));

  return {
    customDutyMTD: cur.customDuty,
    freightMTD:    cur.freight,
    inputGstMTD:   cur.inputGst,
    outputGstMTD:  cur.outputGst,
    netGstMTD:     cur.outputGst - cur.inputGst,
    tdsMTD:        cur.tds,

    customDutyPrev: prev.customDuty,
    freightPrev:    prev.freight,
    inputGstPrev:   prev.inputGst,
    outputGstPrev:  prev.outputGst,
    tdsPrev:        prev.tds,

    monthly,
    topFreightVendors,
    recent: recent.slice(0, 50),
  };
}
