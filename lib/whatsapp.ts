/**
 * WhatsApp sender service for Robotek FinOS.
 *
 * Supports two providers:
 *   • Meta Cloud API  (recommended — official WhatsApp Business API)
 *   • Twilio          (alternative)
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
  provider:     "meta" | "twilio";
  /** Meta Cloud API */
  meta_token:   string;
  meta_phone_id:string;
  /** Twilio */
  account_sid:  string;
  auth_token:   string;
  from_number:  string;  // e.g. "whatsapp:+14155238886"
};

export type SendResult = {
  sent:       boolean;
  skipped?:   boolean;   // true when provider not configured (dry-run)
  messageId?: string;
  error?:     string;
};

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
  const recipient = to.startsWith("+") ? to : `+91${to}`;

  try {
    if (config.provider === "meta") {
      return await sendViaMeta(config, recipient, body);
    } else {
      return await sendViaTwilio(config, recipient, body);
    }
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

// ── Template renderer ────────────────────────────────────────────────────────

/** Replace {variable} placeholders with values from a map. */
export function renderTemplate(
  template: string,
  vars:     Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}
