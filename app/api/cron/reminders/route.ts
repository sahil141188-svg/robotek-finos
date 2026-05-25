/**
 * Cron endpoint: Daily compliance + task reminders via WhatsApp.
 *
 * Called by Vercel Cron at 09:00 IST (03:30 UTC) every day.
 * Protected by CRON_SECRET — Vercel sets this automatically.
 *
 * What it does:
 *   1. Loads WhatsApp config + reminder rules from app_settings
 *   2. Finds compliance items due in the configured day windows
 *   3. Finds tasks due in the configured day windows
 *   4. Sends WhatsApp to users with notify_whatsapp = true
 *   5. Logs every attempt to notification_log
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { sendWhatsApp, renderTemplate } from "@/lib/whatsapp";
import {
  getWhatsAppConfig,
  getReminderSettings,
  getTemplateSettings,
} from "@/app/actions/notification-settings";

// ── Auth guard ────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev — no secret set
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysFromNow(dateStr: string): number {
  const due  = new Date(dateStr);
  const now  = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86_400_000);
}

/** Format YYYY-MM-DD to "25 May 2026" */
function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [waConfig, reminderRules, templates] = await Promise.all([
    getWhatsAppConfig(),
    getReminderSettings(),
    getTemplateSettings(),
  ]);

  const results = {
    compliance_sent: 0,
    task_sent:       0,
    skipped:         0,
    errors:          0,
  };

  // ── 1. Users who opted in to WhatsApp ───────────────────────────────────────
  const { data: users } = await db
    .from("users")
    .select("id, full_name, whatsapp_number, role")
    .eq("notify_whatsapp", true)
    .eq("is_active", true) as {
      data: { id: string; full_name: string; whatsapp_number: string | null; role: string }[] | null;
    };

  const whatsappUsers = (users ?? []).filter((u) => u.whatsapp_number);
  if (whatsappUsers.length === 0) {
    return NextResponse.json({ message: "No users opted into WhatsApp", ...results });
  }

  // ── 2. Compliance reminders ─────────────────────────────────────────────────
  const { data: complianceItems } = await db
    .from("compliance_items")
    .select("id, title, due_date, status")
    .in("status", ["pending", "overdue"]) as {
      data: { id: string; title: string; due_date: string; status: string }[] | null;
    };

  const dueSoonCompliance = (complianceItems ?? []).filter((item) => {
    const days = daysFromNow(item.due_date);
    return reminderRules.compliance_days_before.includes(days) || days < 0;
  });

  for (const item of dueSoonCompliance) {
    const days = daysFromNow(item.due_date);
    const urgency = days < 0
      ? `⚠️ OVERDUE by ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""}`
      : days === 0
        ? "📅 DUE TODAY"
        : `⏰ Due in ${days} day${days !== 1 ? "s" : ""}`;

    for (const user of whatsappUsers) {
      const body = renderTemplate(templates.compliance_reminder, {
        user_name:        user.full_name,
        compliance_title: item.title,
        due_date:         formatDate(item.due_date),
        urgency,
      });

      const result = await sendWhatsApp(waConfig, user.whatsapp_number!, body);

      // Log
      try {
        await db.from("notification_log").insert({
          user_id:   user.id,
          channel:   "whatsapp",
          recipient: user.whatsapp_number,
          subject:   `Compliance: ${item.title}`,
          body,
          status:    result.sent ? "sent" : result.skipped ? "skipped" : "failed",
          error:     result.error ?? null,
          metadata:  { type: "compliance_reminder", item_id: item.id, days_until_due: days },
        });
      } catch { /* non-fatal */ }

      if (result.sent)         results.compliance_sent++;
      else if (result.skipped) results.skipped++;
      else                     results.errors++;
    }
  }

  // ── 3. Task reminders ────────────────────────────────────────────────────────
  const { data: taskItems } = await db
    .from("tasks")
    .select("id, title, due_date, priority, assigned_to_user_id")
    .not("due_date", "is", null)
    .in("status", ["todo", "in_progress"]) as {
      data: { id: string; title: string; due_date: string | null; priority: string; assigned_to_user_id: string | null }[] | null;
    };

  const dueSoonTasks = (taskItems ?? []).filter((task) => {
    if (!task.due_date) return false;
    const days = daysFromNow(task.due_date);
    return reminderRules.task_days_before.includes(days) || days < 0;
  });

  for (const task of dueSoonTasks) {
    if (!task.due_date) continue;
    const days = daysFromNow(task.due_date);

    // Only notify the assigned user (if they opted in), else notify all WhatsApp users
    const targets = task.assigned_to_user_id
      ? whatsappUsers.filter((u) => u.id === task.assigned_to_user_id)
      : whatsappUsers;

    for (const user of targets) {
      const body = renderTemplate(templates.task_reminder, {
        user_name:  user.full_name,
        task_title: task.title,
        due_date:   formatDate(task.due_date),
        priority:   task.priority ?? "Normal",
        days_label: days < 0
          ? `OVERDUE by ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""}`
          : days === 0 ? "DUE TODAY" : `due in ${days} day${days !== 1 ? "s" : ""}`,
      });

      const result = await sendWhatsApp(waConfig, user.whatsapp_number!, body);

      try {
        await db.from("notification_log").insert({
          user_id:   user.id,
          channel:   "whatsapp",
          recipient: user.whatsapp_number,
          subject:   `Task: ${task.title}`,
          body,
          status:    result.sent ? "sent" : result.skipped ? "skipped" : "failed",
          error:     result.error ?? null,
          metadata:  { type: "task_reminder", task_id: task.id, days_until_due: days },
        });
      } catch { /* non-fatal */ }

      if (result.sent)         results.task_sent++;
      else if (result.skipped) results.skipped++;
      else                     results.errors++;
    }
  }

  return NextResponse.json({
    success: true,
    ...results,
    message: `Sent ${results.compliance_sent} compliance + ${results.task_sent} task reminders`,
  });
}
