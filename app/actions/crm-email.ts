"use server";

/**
 * Sales OS — email channel actions (templates + send via Resend).
 */
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Result = { error: string | null };

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

// ── TEMPLATES ───────────────────────────────────────────────

export async function createEmailTemplate(formData: FormData): Promise<Result> {
  const uid = await currentUserId();
  if (!uid) return { error: "Not authenticated" };
  const name = str(formData, "name");
  const subject = str(formData, "subject");
  const body = str(formData, "body");
  if (!name || !subject || !body) return { error: "Name, subject and body are required" };

  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("crm_email_templates").insert({
    name, subject, body, category: str(formData, "category"), created_by: uid,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales-os/email");
  return { error: null };
}

export async function toggleEmailTemplate(id: string, isActive: boolean): Promise<Result> {
  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("crm_email_templates").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales-os/email");
  return { error: null };
}

// ── SEND ────────────────────────────────────────────────────

export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
  accountId?: string | null;
  leadId?: string | null;
}): Promise<Result> {
  const uid = await currentUserId();
  if (!uid) return { error: "Not authenticated" };
  if (!input.to?.trim()) return { error: "Recipient email is required" };
  if (!input.subject?.trim() || !input.body?.trim()) return { error: "Subject and body are required" };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SALES_FROM_EMAIL ?? process.env.BRIEFING_FROM_EMAIL ?? "sales@robotek.in";

  const html = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.7; color: #1F1B20;">${input.body.replace(/\n/g, "<br>")}</div>`;

  let status: "sent" | "failed" | "skipped" = "skipped";
  let errorMsg: string | null = null;

  if (apiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from, to: input.to.trim(), subject: input.subject.trim(), html, text: input.body,
      });
      if (error) { status = "failed"; errorMsg = String(error); }
      else status = "sent";
    } catch (e) {
      status = "failed";
      errorMsg = e instanceof Error ? e.message : "Send failed";
    }
  } else {
    errorMsg = "RESEND_API_KEY not set — email logged as skipped (dry run)";
  }

  // Log to notification_log (channel 'email').
  try {
    const supabase = (await createClient()) as any;
    await supabase.from("notification_log").insert({
      user_id: uid,
      channel: "email",
      recipient: input.to.trim(),
      subject: input.subject.trim(),
      body: input.body,
      status,
      error: errorMsg,
      metadata: { type: "crm_email", account_id: input.accountId ?? null, lead_id: input.leadId ?? null },
    });
  } catch { /* non-fatal */ }

  if (status === "failed") return { error: errorMsg ?? "Send failed" };
  if (status === "skipped") return { error: errorMsg };
  return { error: null };
}
