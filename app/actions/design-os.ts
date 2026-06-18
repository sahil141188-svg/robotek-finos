"use server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendWhatsApp } from "@/lib/whatsapp";
import { getWhatsAppConfig } from "@/app/actions/notification-settings";

// WhatsApp numbers for the design team
const DESIGNER_PHONES: Record<string, string> = {
  vishal: process.env.DESIGNER_VISHAL_PHONE ?? "",
  nitin:  process.env.DESIGNER_NITIN_PHONE  ?? "",
  both:   "",
};
const SARTHAK_PHONE = process.env.REVIEWER_SARTHAK_PHONE ?? "";

export type TaskStatus =
  | "pending_review"
  | "approved"
  | "needs_correction"
  | "final_approved"
  | "rejected";

export type DesignTask = {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  platform: string | null;
  assigned_to: string;
  deadline: string | null;
  priority: string;
  reference_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  latest_submission?: DesignSubmission | null;
};

export type DesignSubmission = {
  id: string;
  task_id: string;
  round: number;
  submitted_by: string;
  submitted_at: string;
  status: TaskStatus;
  reviewer_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  final_note: string | null;
  final_by: string | null;
  final_at: string | null;
  files?: DesignFile[];
};

export type DesignFile = {
  id: string;
  submission_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string;
};

async function getDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await createClient()) as any;
}

// ── Create a new task (management only) ──
export async function createDesignTask(formData: FormData) {
  const db = await getDb();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await db.from("design_tasks").insert({
    title:         formData.get("title") as string,
    description:   (formData.get("description") as string) || null,
    task_type:     formData.get("task_type") as string,
    platform:      (formData.get("platform") as string) || null,
    assigned_to:   formData.get("assigned_to") as string,
    deadline:      (formData.get("deadline") as string) || null,
    priority:      (formData.get("priority") as string) || "medium",
    reference_url: (formData.get("reference_url") as string) || null,
    notes:         (formData.get("notes") as string) || null,
    created_by:    user.id,
  });

  if (error) throw new Error(error.message);

  // Send WhatsApp notification to assigned designer(s)
  try {
    const waConfig = await getWhatsAppConfig();
    const assignedTo = (formData.get("assigned_to") as string) || "";
    const title      = (formData.get("title") as string) || "";
    const deadline   = (formData.get("deadline") as string) || "";
    const priority   = (formData.get("priority") as string) || "medium";
    const msg = `🎨 *New Design Task Assigned*\n\n*Task:* ${title}\n*Type:* ${formData.get("task_type")}\n*Priority:* ${priority.toUpperCase()}\n${deadline ? `*Deadline:* ${new Date(deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}\n` : ""}*Notes:* ${(formData.get("notes") as string) || "—"}\n\nPlease upload your design at: robotek.design`;

    const recipients = assignedTo === "both"
      ? [DESIGNER_PHONES.vishal, DESIGNER_PHONES.nitin].filter(Boolean)
      : [DESIGNER_PHONES[assignedTo]].filter(Boolean);

    for (const phone of recipients) {
      await sendWhatsApp(waConfig, phone, msg).catch(() => null);
    }
  } catch { /* WhatsApp is optional — don't block task creation */ }

  revalidatePath("/dashboard/design-os");
}

// ── Get all tasks with their latest submission ──
export async function getDesignTasks(): Promise<DesignTask[]> {
  const db = await getDb();

  const { data: tasks, error } = await db
    .from("design_tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return [];

  const withSubs = await Promise.all(
    ((tasks ?? []) as DesignTask[]).map(async (task) => {
      const { data: subs } = await db
        .from("design_submissions")
        .select("*, files:design_files(*)")
        .eq("task_id", task.id)
        .order("round", { ascending: false })
        .limit(1);

      return { ...task, latest_submission: subs?.[0] ?? null };
    })
  );

  return withSubs as DesignTask[];
}

// ── Get single task with all submissions ──
export async function getDesignTask(id: string) {
  const db = await getDb();

  const { data: task } = await db
    .from("design_tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (!task) return null;

  const { data: submissions } = await db
    .from("design_submissions")
    .select("*, files:design_files(*)")
    .eq("task_id", id)
    .order("round", { ascending: false });

  return { ...task, submissions: submissions ?? [] };
}

// ── Designer submits design files ──
export async function submitDesign(formData: FormData) {
  const db = await getDb();

  const task_id      = formData.get("task_id") as string;
  const submitted_by = formData.get("submitted_by") as string;

  const { data: existing } = await db
    .from("design_submissions")
    .select("round")
    .eq("task_id", task_id)
    .order("round", { ascending: false })
    .limit(1);

  const nextRound = ((existing as Array<{ round: number }>)?.[0]?.round ?? 0) + 1;

  const { data: sub, error: subErr } = await db
    .from("design_submissions")
    .insert({ task_id, round: nextRound, submitted_by, status: "pending_review" })
    .select()
    .single();

  if (subErr) throw new Error(subErr.message);

  const fileData = formData.get("files_json") as string;
  if (fileData) {
    const files = JSON.parse(fileData) as Array<{
      file_name: string;
      file_url: string;
      file_type: string;
      file_size: number;
    }>;
    if (files.length > 0) {
      await db.from("design_files").insert(
        files.map((f) => ({ submission_id: (sub as { id: string }).id, ...f }))
      );
    }
  }

  revalidatePath(`/dashboard/design-os/tasks/${task_id}`);
  revalidatePath("/dashboard/design-os");
}

// ── Sarthak reviews: approve or request corrections ──
export async function reviewSubmission(
  submissionId: string,
  decision: "approved" | "needs_correction",
  note: string
) {
  const db = await getDb();

  const { error } = await db
    .from("design_submissions")
    .update({
      status:        decision,
      reviewer_note: note || null,
      reviewed_by:   "sarthak",
      reviewed_at:   new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) throw new Error(error.message);

  const { data } = await db
    .from("design_submissions")
    .select("task_id, submitted_by, design_tasks(title)")
    .eq("id", submissionId)
    .single();

  const sub = data as { task_id: string; submitted_by: string; design_tasks: { title: string } } | null;

  // Notify designer via WhatsApp
  try {
    const waConfig = await getWhatsAppConfig();
    const phone = DESIGNER_PHONES[sub?.submitted_by ?? ""] ?? "";
    if (phone) {
      const msg = decision === "approved"
        ? `✅ *Design Approved by Sarthak*\n\n*Task:* ${sub?.design_tasks?.title}\n\nPlease share in the WhatsApp group for final management approval.`
        : `↩ *Design Correction Required*\n\n*Task:* ${sub?.design_tasks?.title}\n\n*Feedback:* ${note || "Please review and resubmit."}\n\nLogin to upload the corrected version.`;
      await sendWhatsApp(waConfig, phone, msg).catch(() => null);
    }
    // Also notify Sarthak if approved (for management step)
    if (decision === "approved" && SARTHAK_PHONE) {
      await sendWhatsApp(waConfig, SARTHAK_PHONE, `✅ You approved: *${sub?.design_tasks?.title}*. Management final approval pending.`).catch(() => null);
    }
  } catch { /* optional */ }

  revalidatePath(`/dashboard/design-os/tasks/${sub?.task_id}`);
  revalidatePath("/dashboard/design-os");
}

// ── Management gives final approval ──
export async function finalApproval(
  submissionId: string,
  decision: "final_approved" | "rejected",
  note: string
) {
  const db = await getDb();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await db
    .from("design_submissions")
    .update({
      status:     decision,
      final_note: note || null,
      final_by:   user.id,
      final_at:   new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) throw new Error(error.message);

  const { data } = await db
    .from("design_submissions")
    .select("task_id, submitted_by, design_tasks(title, assigned_to)")
    .eq("id", submissionId)
    .single();

  const sub2 = data as { task_id: string; submitted_by: string; design_tasks: { title: string; assigned_to: string } } | null;

  // Notify designer & reviewer via WhatsApp on final decision
  try {
    const waConfig = await getWhatsAppConfig();
    const designerPhone = DESIGNER_PHONES[sub2?.design_tasks?.assigned_to ?? ""] ?? "";
    const taskTitle = sub2?.design_tasks?.title ?? "";
    const msg = decision === "final_approved"
      ? `🎉 *Final Approval Granted!*\n\n*Task:* ${taskTitle}\n\nManagement has given final approval. Great work!`
      : `❌ *Design Rejected by Management*\n\n*Task:* ${taskTitle}\n\n*Reason:* ${note || "—"}`;
    if (designerPhone) await sendWhatsApp(waConfig, designerPhone, msg).catch(() => null);
    if (SARTHAK_PHONE)  await sendWhatsApp(waConfig, SARTHAK_PHONE, msg).catch(() => null);
  } catch { /* optional */ }

  revalidatePath(`/dashboard/design-os/tasks/${sub2?.task_id}`);
  revalidatePath("/dashboard/design-os");
}
