/**
 * POST /api/stock/restock-notify
 *
 * Called by the Google Apps Script when products come back in stock.
 * Apps Script scans the Enquiries tab, finds customers who enquired about
 * those products, and sends this endpoint the list.
 *
 * We then send each customer a WhatsApp message using the same WhatsApp
 * provider already configured in FinOS (Meta / Twilio / Maytapi).
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
import { getWhatsAppConfig }         from "@/app/actions/notification-settings";

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

// ── WhatsApp message builder ──────────────────────────────────────────────────

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

  // 3. Load WhatsApp config (same settings as FinOS reminders)
  const waConfig = await getWhatsAppConfig();

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
  const detail: { customer: string; product: string; status: string; error?: string }[] = [];

  for (const enq of enquiries) {

    // Skip if no phone number
    if (!enq.phone || enq.phone.trim() === "") {
      results.skipped++;
      detail.push({ customer: enq.customer, product: enq.product, status: "skipped_no_phone" });
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
      detail.push({ customer: enq.customer, product: enq.product, status: "sent" });
    } else if (result.skipped) {
      results.skipped++;
      detail.push({ customer: enq.customer, product: enq.product, status: "skipped_wa_disabled" });
    } else {
      results.errors++;
      detail.push({ customer: enq.customer, product: enq.product, status: "error", error: result.error });
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
