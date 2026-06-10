/**
 * POST /api/stock/restock-notify
 *
 * Called by the Google Apps Script when products come back in stock.
 * Apps Script scans the Enquiries tab, finds customers who enquired about
 * those products, and sends this endpoint the list.
 *
 * We then:
 *   1. Send each customer a WhatsApp message (product back in stock)
 *   2. Send the CRM / sales team a summary WhatsApp so they know who was
 *      contacted and can follow up if needed.
 *
 * Auth: Authorization: Bearer <STOCK_NOTIFY_SECRET>
 *
 * Request body:
 *   {
 *     products: string[],           // restocked product names
 *     enquiries: {                  // customers to notify
 *       customer: string,
 *       phone:    string,
 *       product:  string,
 *       enqDate:  string
 *     }[]
 *   }
 *
 * Response:
 *   { success: true, sent: number, skipped: number, errors: number, detail: [...] }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { sendWhatsApp }              from "@/lib/whatsapp";
import { getWhatsAppConfig, getBriefingSettings } from "@/app/actions/notification-settings";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EnquiryNotify {
  customer: string;
  phone:    string;
  product:  string;
  enqDate:  string;
}

interface RequestBody {
  products:  string[];
  enquiries: EnquiryNotify[];
}

// ── Auth guard ────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.STOCK_NOTIFY_SECRET;
  if (!secret) return true; // dev — no secret configured, allow all
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

// ── WhatsApp message builders ─────────────────────────────────────────────────

function buildCustomerMessage(customerName: string, product: string, enqDate: string): string {
  const greeting = customerName ? `Hi *${customerName}*! 👋\n\n` : "Hi! 👋\n\n";
  return (
    greeting +
    `Great news — *${product}* is back in stock! 🎉\n\n` +
    `You had enquired about this product on ${enqDate || "a recent date"}.\n` +
    `It's available now — order before it sells out again! 👇\n\n` +
    `🛒 *Check stock & order:*\n` +
    `https://robotekstock.vercel.app\n\n` +
    `_— Team Robotek_`
  );
}

/**
 * Build the CRM summary WhatsApp message.
 *
 * Groups results by product so sales can see at a glance which items
 * were restocked and exactly which customers were notified.
 *
 * Example output:
 *   🔔 Restock Alert — Customer Notifications Sent
 *
 *   📦 DC 101 — 2 customers notified:
 *   1. Sharma Mobile — 9810XXXXXX ✅
 *   2. Kumar Store — 9876XXXXXX ✅
 *
 *   📦 BN47 — 1 notified, 1 skipped:
 *   3. Raj Electronics — 9999XXXXXX ✅
 *   4. Delhi Mobiles — (no phone) ⚠️
 *
 *   Total: 3 sent · 1 skipped · 0 errors
 *   🛒 robotekstock.vercel.app
 */
function buildCrmSummary(
  products: string[],
  detail:   { customer: string; product: string; phone: string; status: string }[],
): string {
  // Group by product
  const byProduct = new Map<string, typeof detail>();
  for (const d of detail) {
    const arr = byProduct.get(d.product) ?? [];
    arr.push(d);
    byProduct.set(d.product, arr);
  }

  const lines: string[] = [
    `🔔 *Restock Alert — CRM Update*`,
    ``,
  ];

  // Products that had no enquiries at all (mentioned for awareness)
  const notifiedProducts = new Set(detail.map(d => d.product));
  const noEnqProducts    = products.filter(p => !notifiedProducts.has(p));

  let serial = 1;

  for (const [product, rows] of byProduct.entries()) {
    const sent    = rows.filter(r => r.status === "sent").length;
    const skipped = rows.filter(r => r.status !== "sent").length;

    const countStr = skipped > 0
      ? `${sent} notified, ${skipped} skipped`
      : `${sent} customer${sent !== 1 ? "s" : ""} notified`;

    lines.push(`📦 *${product}* — ${countStr}:`);

    for (const r of rows) {
      const statusIcon = r.status === "sent" ? "✅" : r.status === "skipped_no_phone" ? "⚠️ no phone" : "❌";
      const phone      = r.phone ? r.phone : "—";
      lines.push(`${serial}. ${r.customer || "Unknown"} — ${phone} ${statusIcon}`);
      serial++;
    }
    lines.push(``);
  }

  // Products back in stock but with no enquiries on record
  if (noEnqProducts.length > 0) {
    lines.push(`📋 *Back in stock (no enquiries):*`);
    for (const p of noEnqProducts) lines.push(`• ${p}`);
    lines.push(``);
  }

  const totalSent    = detail.filter(d => d.status === "sent").length;
  const totalSkipped = detail.filter(d => d.status !== "sent" && !d.status.startsWith("error")).length;
  const totalErrors  = detail.filter(d => d.status.startsWith("error")).length;

  lines.push(
    `📊 *Total: ${totalSent} sent · ${totalSkipped} skipped · ${totalErrors} errors*`,
    ``,
    `Check _Restock Alerts_ tab in the Sheet for full details.`,
    `🛒 robotekstock.vercel.app`,
  );

  return lines.join("\n");
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {

  // 1. Auth check
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // 2. Parse body
  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { products = [], enquiries = [] } = body;

  if (!enquiries.length) {
    return NextResponse.json({
      success: true,
      message: "No enquiries to notify",
      sent: 0, skipped: 0, errors: 0,
    });
  }

  // 3. Load WhatsApp config + CRM briefing recipients in parallel
  const [waConfig, briefing] = await Promise.all([
    getWhatsAppConfig(),
    getBriefingSettings(),
  ]);

  // 4. Supabase client for logging
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // 5. Send WhatsApp to each enquiring customer
  const results = { sent: 0, skipped: 0, errors: 0 };
  const detail: { customer: string; product: string; phone: string; status: string; error?: string }[] = [];

  for (const enq of enquiries) {

    // Skip if no phone number
    if (!enq.phone || enq.phone.trim() === "") {
      results.skipped++;
      detail.push({ customer: enq.customer, product: enq.product, phone: "", status: "skipped_no_phone" });
      continue;
    }

    const message = buildCustomerMessage(enq.customer, enq.product, enq.enqDate);
    const result  = await sendWhatsApp(waConfig, enq.phone.trim(), message);

    // Log to notification_log
    try {
      await db.from("notification_log").insert({
        user_id:   null,           // external customer — not a FinOS user
        channel:   "whatsapp",
        recipient: enq.phone,
        subject:   `Restock: ${enq.product}`,
        body:      message,
        status:    result.sent ? "sent" : result.skipped ? "skipped" : "failed",
        error:     result.error ?? null,
        metadata:  {
          type:        "stock_restock_notify",
          product:     enq.product,
          customer:    enq.customer,
          enq_date:    enq.enqDate,
          products_restocked: products,
        },
      });
    } catch { /* logging failure is non-fatal */ }

    if (result.sent) {
      results.sent++;
      detail.push({ customer: enq.customer, product: enq.product, phone: enq.phone.trim(), status: "sent" });
    } else if (result.skipped) {
      results.skipped++;
      detail.push({ customer: enq.customer, product: enq.product, phone: enq.phone.trim(), status: "skipped_wa_disabled" });
    } else {
      results.errors++;
      detail.push({ customer: enq.customer, product: enq.product, phone: enq.phone.trim(), status: "error", error: result.error });
    }
  }

  // 6. Send CRM summary to all briefing recipients (sales / management team)
  //    This fires after all customer messages so the totals are final.
  if (briefing.recipients && briefing.recipients.length > 0) {
    const crmMessage = buildCrmSummary(products, detail);

    for (const recipient of briefing.recipients) {
      if (!recipient.phone) continue;
      try {
        const crmResult = await sendWhatsApp(waConfig, recipient.phone, crmMessage);
        // Log CRM notification
        await db.from("notification_log").insert({
          user_id:   null,
          channel:   "whatsapp",
          recipient: recipient.phone,
          subject:   `Restock CRM Alert — ${products.join(", ")}`,
          body:      crmMessage,
          status:    crmResult.sent ? "sent" : crmResult.skipped ? "skipped" : "failed",
          error:     crmResult.error ?? null,
          metadata:  {
            type:              "stock_restock_crm_summary",
            recipient_name:    recipient.name,
            products_restocked: products,
            customers_notified: results.sent,
          },
        }).catch(() => { /* non-fatal */ });
      } catch {
        // CRM notification failure should not affect the main response
        console.error(`[restock-notify] CRM WhatsApp to ${recipient.name} (${recipient.phone}) failed`);
      }
    }
  }

  return NextResponse.json({
    success: true,
    products_restocked: products,
    ...results,
    message: `Sent ${results.sent} restock notifications (${results.skipped} skipped, ${results.errors} errors)`,
    detail,
  });
}
