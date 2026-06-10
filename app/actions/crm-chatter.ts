"use server";

/**
 * Chatter (timeline) + detail-form actions: log notes, change deal stage with
 * an audit entry, set priority, mark won/lost with reason. Every change drops
 * a 'log' message so the record has a full Odoo-style timeline.
 */
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CrmDealStage } from "@/types/database";

type Result = { error: string | null };

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Insert a chatter message (note from a user, or an auto 'log' event). */
async function insertMessage(sb: any, parentType: string, parentId: string, body: string, kind: "note" | "log" | "message", uid: string | null) {
  await sb.from("crm_messages").insert({ parent_type: parentType, parent_id: parentId, body, kind, author_id: uid });
}

function pathFor(parentType: string, parentId: string): string {
  if (parentType === "deal") return `/dashboard/sales-os/deals/${parentId}`;
  if (parentType === "lead") return `/dashboard/sales-os/leads/${parentId}`;
  return `/dashboard/sales-os/accounts/${parentId}`;
}

/** Log a manual note on a lead/deal/account. */
export async function logNote(input: { parentType: string; parentId: string; body: string }): Promise<Result> {
  const body = input.body?.trim();
  if (!body) return { error: "Write something first" };
  const uid = await currentUserId();
  const sb = (await createClient()) as any;
  await insertMessage(sb, input.parentType, input.parentId, body, "note", uid);
  revalidatePath(pathFor(input.parentType, input.parentId));
  return { error: null };
}

/** Move a deal to a new stage (from the detail form) with an audit log entry. */
export async function setDealStage(id: string, stage: CrmDealStage, lostReasonId?: string | null): Promise<Result> {
  const uid = await currentUserId();
  const sb = (await createClient()) as any;

  const update: Record<string, unknown> = { stage };
  if (stage === "lost" && lostReasonId) update.lost_reason_id = lostReasonId;
  const { error } = await sb.from("crm_deals").update(update).eq("id", id);
  if (error) return { error: error.message };

  let label = `Stage → ${stage}`;
  if (stage === "won") label = "🏆 Marked Won";
  if (stage === "lost") {
    let reason = "";
    if (lostReasonId) {
      const { data } = await sb.from("crm_lost_reasons").select("name").eq("id", lostReasonId).single();
      reason = (data as { name?: string } | null)?.name ? ` — ${(data as { name: string }).name}` : "";
    }
    label = `Marked Lost${reason}`;
  }
  await insertMessage(sb, "deal", id, label, "log", uid);

  revalidatePath(`/dashboard/sales-os/deals/${id}`);
  revalidatePath("/dashboard/sales-os/pipeline");
  return { error: null };
}

/** Set priority (COLD/MEDIUM/HOT) on a lead or deal, with an audit entry. */
export async function setPriority(parentType: "lead" | "deal", id: string, priority: string): Promise<Result> {
  const uid = await currentUserId();
  const sb = (await createClient()) as any;
  const table = parentType === "deal" ? "crm_deals" : "crm_leads";
  const { error } = await sb.from(table).update({ priority }).eq("id", id);
  if (error) return { error: error.message };
  await insertMessage(sb, parentType, id, `Priority → ${priority}`, "log", uid);
  revalidatePath(pathFor(parentType, id));
  return { error: null };
}
