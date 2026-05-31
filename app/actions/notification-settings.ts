"use server";

/**
 * Notification Settings Server Actions
 *
 * Reads / writes notification config (WhatsApp, SMTP, reminder rules, templates)
 * from the app_settings table in Supabase.
 *
 * Also exposes:
 *   sendTestWhatsApp  — lets admin verify WhatsApp config before going live
 *   getNotificationLog — paginated log of sent notifications
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  sendWhatsApp,
  type WhatsAppConfig,
} from "@/lib/whatsapp";
import type { Database } from "@/types/database";

// ── Types ────────────────────────────────────────────────────────────────────

export type EmailSettings = {
  enabled:       boolean;
  sender_name:   string;
  from_email:    string;
  smtp_host:     string;
  smtp_port:     string;
  smtp_user:     string;
  smtp_password: string;
  use_tls:       boolean;
};

export type ReminderSettings = {
  compliance_days_before: number[];
  task_days_before:       number[];
  ar_days_before_due:     number;
  ar_days_after_due:      number;
  escalation_hours:       number;
  /** Minimum days between consecutive WhatsApp reminders to the SAME customer. */
  ar_min_days_between_reminders?: number;
  /** Delay (ms) between API calls when sending in bulk — avoids WhatsApp rate limits. */
  ar_inter_message_delay_ms?: number;
};

export type TemplateSettings = {
  ar_reminder:          string;
  compliance_reminder:  string;
  task_reminder:        string;
};

/** Recipients + schedule for the daily morning executive WhatsApp brief. */
export type BriefingSettings = {
  enabled:       boolean;
  /** "HH:MM" 24-hr in IST. Informational only — actual schedule lives in vercel.json. */
  send_time_ist: string;
  recipients:    Array<{ name: string; phone: string }>;
};

export type AllNotificationSettings = {
  whatsapp:  WhatsAppConfig;
  email:     EmailSettings;
  reminders: ReminderSettings;
  templates: TemplateSettings;
  briefing:  BriefingSettings;
};

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: AllNotificationSettings = {
  whatsapp: {
    enabled:            false,
    provider:           "meta",
    meta_token:         "",
    meta_phone_id:      "",
    account_sid:        "",
    auth_token:         "",
    from_number:        "",
    maytapi_product_id: "",
    maytapi_phone_id:   "",
    maytapi_token:      "",
  },
  email: {
    enabled:       true,
    sender_name:   "Robotek FinOS",
    from_email:    "noreply@robotek.in",
    smtp_host:     "smtp.gmail.com",
    smtp_port:     "587",
    smtp_user:     "",
    smtp_password: "",
    use_tls:       true,
  },
  reminders: {
    compliance_days_before: [14, 7, 3, 1],
    task_days_before:       [7, 3, 1],
    ar_days_before_due:     3,
    ar_days_after_due:      1,
    escalation_hours:       24,
    ar_min_days_between_reminders: 3,
    ar_inter_message_delay_ms:     2000,
  },
  templates: {
    ar_reminder:
      "Dear *{customer_name}*,\n\nFriendly reminder — your outstanding balance with *{company_name}* is *₹{amount}* (oldest invoice dated {due_date}, {days_overdue} days outstanding).\n\nKindly arrange payment at your earliest convenience. If you have already paid, please share the UTR.\n\nThank you,\n{company_name} Accounts Team",
    compliance_reminder:
      "Hi {user_name},\n\nAction required: {compliance_title} is due on {due_date}.\n\nPlease complete this filing on time to avoid penalties.\n\nRobotek FinOS — Compliance Calendar",
    task_reminder:
      "Hi {user_name},\n\nReminder: Task \"{task_title}\" assigned to you is due on {due_date}.\n\nPlease update the status on Robotek FinOS.\n\nPriority: {priority}",
  },
  briefing: {
    enabled:       true,
    send_time_ist: "08:00",
    recipients: [
      { name: "Aman",   phone: "+919810504008" },
      { name: "Sahil",  phone: "+919899444530" },
    ],
  },
};

// ── Load ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all notification settings from app_settings table.
 * Falls back to DEFAULTS for any missing keys.
 */
export async function getNotificationSettings(): Promise<AllNotificationSettings> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data, error } = await db
      .from("app_settings")
      .select("key, value") as {
        data: { key: string; value: unknown }[] | null;
        error: unknown;
      };

    if (error || !data) return DEFAULTS;

    const map = new Map(data.map((r) => [r.key, r.value]));

    const rawWhatsapp = { ...DEFAULTS.whatsapp, ...(map.get("whatsapp") as Partial<WhatsAppConfig> ?? {}) };

    // Bug #15 fix: account_sid must start with "AC" (Twilio format) or be empty.
    // If it contains an email address or other invalid value (data mapping error),
    // reset it to empty string to avoid displaying wrong data in the form.
    if (rawWhatsapp.account_sid && !rawWhatsapp.account_sid.startsWith("AC")) {
      console.warn("[notification-settings] account_sid has invalid format — clearing:", rawWhatsapp.account_sid);
      rawWhatsapp.account_sid = "";
    }

    return {
      whatsapp:  rawWhatsapp,
      email:     { ...DEFAULTS.email,     ...(map.get("email")     as Partial<EmailSettings>    ?? {}) },
      reminders: { ...DEFAULTS.reminders, ...(map.get("reminders") as Partial<ReminderSettings> ?? {}) },
      templates: { ...DEFAULTS.templates, ...(map.get("templates") as Partial<TemplateSettings> ?? {}) },
      briefing:  { ...DEFAULTS.briefing,  ...(map.get("briefing")  as Partial<BriefingSettings>  ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

// ── Save ─────────────────────────────────────────────────────────────────────

/**
 * Persist notification settings. CEO only.
 * Upserts each section as a separate row in app_settings.
 */
export async function saveNotificationSettings(
  settings: Partial<AllNotificationSettings>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Assert CEO role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile as { role: string }).role !== "ceo") {
    return { success: false, error: "Only the CEO can change notification settings" };
  }

  const now = new Date().toISOString();
  const rows = Object.entries(settings).map(([key, value]) => ({
    key,
    value,
    updated_at: now,
  }));

  const { error } = await db
    .from("app_settings")
    .upsert(rows, { onConflict: "key" }) as { error: { message: string } | null };

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/admin/settings");
  return { success: true };
}

// ── Test WhatsApp ─────────────────────────────────────────────────────────────

/**
 * Send a test WhatsApp message to verify the API credentials.
 * CEO only.
 */
export async function sendTestWhatsApp(
  phone: string,
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { sent: false, error: "Not authenticated" };

  const settings = await getNotificationSettings();
  const config   = settings.whatsapp;

  const result = await sendWhatsApp(
    config,
    phone,
    "✅ Robotek FinOS — WhatsApp test successful! Your notification channel is working correctly.",
  );

  // Log the attempt
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    await db.from("notification_log").insert({
      user_id:   user.id,
      channel:   "whatsapp",
      recipient: phone,
      subject:   "Test Message",
      body:      "WhatsApp test message",
      status:    result.sent ? "sent" : result.skipped ? "skipped" : "failed",
      error:     result.error ?? null,
      metadata:  { test: true, message_id: result.messageId },
    });
  } catch {
    // Log failure is non-fatal
  }

  return result;
}

// ── Notification Log ─────────────────────────────────────────────────────────

export type NotificationLogEntry = {
  id:        string;
  channel:   "whatsapp" | "email";
  recipient: string;
  subject:   string | null;
  body:      string;
  status:    "sent" | "failed" | "skipped";
  error:     string | null;
  created_at:string;
  user_id:   string | null;
};

export async function getNotificationLog(
  limit = 50,
): Promise<NotificationLogEntry[]> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data } = await db
      .from("notification_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit) as { data: NotificationLogEntry[] | null };
    return data ?? [];
  } catch {
    return [];
  }
}

// ── Helper: get WhatsApp config (used by cron) ───────────────────────────────

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const settings = await getNotificationSettings();
  return settings.whatsapp;
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  const settings = await getNotificationSettings();
  return settings.reminders;
}

export async function getTemplateSettings(): Promise<TemplateSettings> {
  const settings = await getNotificationSettings();
  return settings.templates;
}

export async function getBriefingSettings(): Promise<BriefingSettings> {
  const settings = await getNotificationSettings();
  return settings.briefing;
}
