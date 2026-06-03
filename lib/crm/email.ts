/**
 * Sales OS — email templates data access (server-only).
 */
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type EmailTemplate = Database["public"]["Tables"]["crm_email_templates"]["Row"];

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const sb = (await createClient()) as any;
  const { data } = await sb.from("crm_email_templates").select("*").order("created_at", { ascending: false });
  return (data ?? []) as EmailTemplate[];
}

/** Fill {{name}} / {{company}} placeholders. */
export function renderEmail(text: string, vars: { name?: string | null; company?: string | null }): string {
  return text
    .replace(/\{\{\s*name\s*\}\}/g, (vars.name ?? "there").trim() || "there")
    .replace(/\{\{\s*company\s*\}\}/g, (vars.company ?? "your business").trim() || "your business");
}
