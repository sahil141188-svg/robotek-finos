/**
 * WhatsApp sender service for Robotek FinOS.
 *
 * Supports three providers:
 *   • Meta Cloud API  (official WhatsApp Business API)
 *   • Twilio          (alternative)
 *   • Maytapi         (third-party gateway via WhatsApp Web bridge)
 *
 * When no credentials are configured the function logs a dry-run and
 * returns { sent: false, skipped: true } so the rest of the codebase
 * works in staging without a live API key.
 *
 * Usage:
 *   const result = await sendWhatsApp(config, "+919876543210", "Hello!");
 *   if (!result.sent) console.error(result.error);
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type WhatsAppConfig = {
  enabled:      boolean;
  provider:     "meta" | "twilio" | "maytapi";
  /** Meta Cloud API */
  meta_token:   string;
  meta_phone_id:string;
  /** Twilio */
  account_sid:  string;
  auth_token:   string;
  from_number:  string;  // e.g. "whatsapp:+14155238886"
  /** Maytapi (third-party WhatsApp gateway) */
  maytapi_product_id?: string;  // UUID of the product in your Maytapi dashboard
  maytapi_phone_id?:   string;  // UUID of the WhatsApp phone connected in Maytapi
  maytapi_token?:      string;  // x-maytapi-key header value
};

export type SendResult = {
  sent:       boolean;
  skipped?:   boolean;   // true when provider not configured (dry-run)
  messageId?: string;
  error?:     string;
};

/**
 * Returns true when the WhatsApp toggle is ON AND the selected provider has
 * every credential it needs. Use this everywhere the UI needs to ask
 * "is WhatsApp actually live right now?" (status banners, disabled-button
 * states, cron-eligibility checks). Centralised here so every supported
 * provider stays in sync — adding a new provider only requires updating
 * this function + the provider switch in sendWhatsApp().
 */
export function isWhatsAppLive(config: WhatsAppConfig): boolean {
  if (!config.enabled) return false;
  switch (config.provider) {
    case "meta":
      return !!config.meta_token && !!config.meta_phone_id;
    case "twilio":
      return !!config.account_sid && !!config.auth_token && !!config.from_number;
    case "maytapi":
      return !!config.maytapi_product_id && !!config.maytapi_phone_id && !!config.maytapi_token;
    default:
      return false;
  }
}

// ── Main sender ──────────────────────────────────────────────────────────────

/**
 * Sends a WhatsApp text message.
 * `to` should be an E.164 number (+919876543210).
 */
export async function sendWhatsApp(
  config: WhatsAppConfig,
  to:     string,
  body:   string,
): Promise<SendResult> {
  if (!config.enabled) {
    console.log(`[whatsapp] disabled — skipping message to ${to}`);
    return { sent: false, skipped: true };
  }

  // Normalise number to E.164
  // Strip all non-digits first, then add + prefix.
  // If already 12 digits starting with 91 (India) — it has the country code.
  // If 10 digits — bare Indian mobile, prepend 91.
  const digits = to.replace(/\D/g, "");
  const recipient = digits.length >= 11 ? `+${digits}` : `+91${digits}`;

  try {
    if (config.provider === "meta")    return await sendViaMeta(config, recipient, body);
    if (config.provider === "maytapi") return await sendViaMaytapi(config, recipient, body);
    return await sendViaTwilio(config, recipient, body);
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    console.error(`[whatsapp] send failed to ${recipient}:`, error);
    return { sent: false, error };
  }
}

// ── Meta Cloud API ───────────────────────────────────────────────────────────

async function sendViaMeta(
  config:    WhatsAppConfig,
  to:        string,
  body:      string,
): Promise<SendResult> {
  if (!config.meta_token || !config.meta_phone_id) {
    console.warn("[whatsapp] Meta credentials not set — dry-run mode");
    console.log(`[whatsapp] DRY-RUN → to:${to} | body:${body.slice(0, 80)}…`);
    return { sent: false, skipped: true };
  }

  const url = `https://graph.facebook.com/v20.0/${config.meta_phone_id}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body, preview_url: false },
  };

  const res = await fetch(url, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${config.meta_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { sent: false, error: `Meta API ${res.status}: ${detail}` };
  }

  const data = (await res.json()) as { messages?: { id: string }[] };
  const messageId = data.messages?.[0]?.id;
  return { sent: true, messageId };
}

// ── Twilio ───────────────────────────────────────────────────────────────────

async function sendViaTwilio(
  config: WhatsAppConfig,
  to:     string,
  body:   string,
): Promise<SendResult> {
  if (!config.account_sid || !config.auth_token || !config.from_number) {
    console.warn("[whatsapp] Twilio credentials not set — dry-run mode");
    console.log(`[whatsapp] DRY-RUN → to:${to} | body:${body.slice(0, 80)}…`);
    return { sent: false, skipped: true };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.account_sid}/Messages.json`;

  const params = new URLSearchParams({
    From: config.from_number,
    To:   `whatsapp:${to}`,
    Body: body,
  });

  const auth = Buffer.from(`${config.account_sid}:${config.auth_token}`).toString("base64");

  const res = await fetch(url, {
    method:  "POST",
    headers: {
      Authorization:  `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { sent: false, error: `Twilio API ${res.status}: ${detail}` };
  }

  const data = (await res.json()) as { sid: string };
  return { sent: true, messageId: data.sid };
}

// ── Maytapi ─────────────────────────────────────────────────────────────────
//
// API: https://maytapi.com/whatsapp-api-documentation
//   POST https://api.maytapi.com/api/{productId}/{phoneId}/sendMessage
//   Headers: x-maytapi-key: {token}
//   Body: { to_number: "919876543210", type: "text", message: "..." }
//
// No 24-hour window or template restriction (gateway uses WhatsApp Web).
//
// Important: Maytapi expects `to_number` WITHOUT a leading `+` — just
// country code + number, e.g. "919876543210".

async function sendViaMaytapi(
  config: WhatsAppConfig,
  to:     string,
  body:   string,
): Promise<SendResult> {
  if (!config.maytapi_product_id || !config.maytapi_phone_id || !config.maytapi_token) {
    console.warn("[whatsapp] Maytapi credentials not set — dry-run mode");
    console.log(`[whatsapp] DRY-RUN → to:${to} | body:${body.slice(0, 80)}…`);
    return { sent: false, skipped: true };
  }

  // Strip the leading + from E.164 (Maytapi rejects it)
  const toNumber = to.replace(/^\+/, "");

  const url = `https://api.maytapi.com/api/${config.maytapi_product_id}/${config.maytapi_phone_id}/sendMessage`;

  const payload = {
    to_number: toNumber,
    type:      "text",
    message:   body,
  };

  const res = await fetch(url, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "x-maytapi-key": config.maytapi_token,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { sent: false, error: `Maytapi API ${res.status}: ${detail}` };
  }

  const data = (await res.json()) as { success?: boolean; data?: { msgId?: string }; message?: string };
  if (data.success === false) {
    return { sent: false, error: `Maytapi: ${data.message ?? "unknown error"}` };
  }
  return { sent: true, messageId: data.data?.msgId };
}

// ── Template renderer ────────────────────────────────────────────────────────

/** Replace {variable} placeholders with values from a map. */
export function renderTemplate(
  template: string,
  vars:     Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}
