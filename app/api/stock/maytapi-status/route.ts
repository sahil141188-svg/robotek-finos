/**
 * GET /api/stock/maytapi-status
 * Debug endpoint — checks Maytapi phone connection status.
 * Protected by the same STOCK_NOTIFY_SECRET bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const secret = process.env.STOCK_NOTIFY_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
  }

  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  ) as any;

  const { data } = await adminDb
    .from("app_settings")
    .select("value")
    .eq("key", "whatsapp")
    .single();

  const wa = data?.value ?? {};

  if (!wa.maytapi_product_id || !wa.maytapi_phone_id || !wa.maytapi_token) {
    return NextResponse.json({ error: "Maytapi credentials not configured in app_settings", wa_raw: wa });
  }

  // Call Maytapi phone status API
  const statusUrl = `https://api.maytapi.com/api/${wa.maytapi_product_id}/${wa.maytapi_phone_id}/status`;
  let statusData: any = null;
  let statusError: string | null = null;

  try {
    const res = await fetch(statusUrl, {
      headers: { "x-maytapi-key": wa.maytapi_token },
    });
    const text = await res.text();
    try { statusData = JSON.parse(text); } catch { statusData = text; }
    if (!res.ok) statusError = `HTTP ${res.status}`;
  } catch (e) {
    statusError = e instanceof Error ? e.message : String(e);
  }

  // Also try to send a test message to check live delivery
  const testUrl = `https://api.maytapi.com/api/${wa.maytapi_product_id}/${wa.maytapi_phone_id}/sendMessage`;
  let testData: any = null;
  let testError: string | null = null;

  try {
    const res = await fetch(testUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-maytapi-key": wa.maytapi_token,
      },
      body: JSON.stringify({
        to_number: "919899444530",
        type: "text",
        message: "🔧 Maytapi debug test — if you see this, delivery is working!",
      }),
    });
    const text = await res.text();
    try { testData = JSON.parse(text); } catch { testData = text; }
    if (!res.ok) testError = `HTTP ${res.status}`;
  } catch (e) {
    testError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    credentials: {
      product_id: wa.maytapi_product_id,
      phone_id: wa.maytapi_phone_id,
      token_last4: wa.maytapi_token?.slice(-4),
      provider: wa.provider,
      enabled: wa.enabled,
    },
    phone_status: { data: statusData, error: statusError },
    test_send:    { data: testData,   error: testError },
  });
}
