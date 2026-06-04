"use server";

/**
 * Sales OS — meeting actions. One-touch: assign a lead + schedule a physical
 * or Zoom meeting with a Sales Expert / FSR. Also drops a follow-up activity
 * onto the assignee so it shows in their Follow-ups + Calendar.
 */
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CrmMeetingMode, CrmMeetingStatus } from "@/types/database";

type Result = { error: string | null };

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function arrangeMeeting(input: {
  leadId: string;
  assignedTo: string;
  mode: CrmMeetingMode;
  scheduledAt: string;       // datetime-local
  location?: string | null;
  meetingLink?: string | null;
  agenda?: string | null;
  conversationNotes?: string | null;
}): Promise<Result> {
  const uid = await currentUserId();
  if (!uid) return { error: "Not authenticated" };
  if (!input.leadId) return { error: "Missing lead" };
  if (!input.assignedTo) return { error: "Pick a Sales Expert / FSR" };
  if (!input.scheduledAt) return { error: "Pick a date & time" };

  const supabase = (await createClient()) as any;

  // Pull lead name for the activity subject.
  const { data: lead } = await supabase.from("crm_leads").select("name, company").eq("id", input.leadId).single();
  const who = lead?.company || lead?.name || "lead";

  const { error } = await supabase.from("crm_meetings").insert({
    lead_id: input.leadId,
    assigned_to: input.assignedTo,
    arranged_by: uid,
    mode: input.mode,
    scheduled_at: input.scheduledAt,
    location: input.location ?? null,
    meeting_link: input.meetingLink ?? null,
    agenda: input.agenda ?? null,
    conversation_notes: input.conversationNotes ?? null,
    status: "scheduled",
  });
  if (error) return { error: error.message };

  // Create a follow-up activity for the assignee so it surfaces in their
  // Follow-ups cockpit + Calendar with the meeting time.
  const typeLabel = input.mode === "physical" ? "visit" : "meeting";
  await supabase.from("crm_activities").insert({
    type: typeLabel,
    subject: `${input.mode === "physical" ? "Field meeting" : input.mode === "zoom" ? "Zoom meeting" : "Call"} with ${who}`,
    body: [input.agenda, input.conversationNotes].filter(Boolean).join(" — ") || null,
    due_at: input.scheduledAt,
    owner_id: input.assignedTo,
    lead_id: input.leadId,
    created_by: uid,
  });

  revalidatePath("/dashboard/sales-os/meetings");
  revalidatePath("/dashboard/sales-os/leads");
  revalidatePath("/dashboard/sales-os/activities");
  return { error: null };
}

export async function updateMeetingStatus(id: string, status: CrmMeetingStatus, outcome?: string): Promise<Result> {
  const supabase = (await createClient()) as any;
  const update: { status: CrmMeetingStatus; outcome?: string } = { status };
  if (outcome) update.outcome = outcome;
  const { error } = await supabase.from("crm_meetings").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/sales-os/meetings");
  return { error: null };
}
