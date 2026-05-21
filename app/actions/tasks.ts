"use server";

/**
 * Task Server Actions — Module 4: Task Management
 *
 * createTask   — insert new task
 * updateTask   — change status / reassign / update details
 * escalateTask — reassign to next role up + add audit note
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { TaskStatus, TaskPriority, TaskModule } from "@/lib/tasks-data";
import type { Database } from "@/types/database";

type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];

// ─── Create task ──────────────────────────────────────────────────────────────

export type CreateTaskPayload = {
  title: string;
  description?: string;
  priority: TaskPriority;
  assigned_to_user_id?: string;  // UUID of a registered user
  assigned_to_name?: string;     // free-text name (manual entry)
  due_date?: string;
  module?: TaskModule;
  compliance_item_id?: string;
};

export async function createTask(
  payload: CreateTaskPayload,
): Promise<{ success: boolean; message: string; id?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated" };

  // assigned_to: prefer registered user UUID, fall back to manual name string
  const assignedTo = payload.assigned_to_user_id ?? payload.assigned_to_name ?? null;

  const insert: TaskInsert = {
    title:               payload.title,
    description:         payload.description ?? null,
    status:              "pending",
    priority:            payload.priority,
    assigned_to:         assignedTo,
    assigned_by:         user.id,
    due_date:            payload.due_date ?? null,
    module:              payload.module ?? "general",
    compliance_item_id:  payload.compliance_item_id ?? null,
  };

  const { data, error } = await db
    .from("tasks")
    .insert(insert)
    .select("id")
    .single() as { data: { id: string } | null; error: { message: string } | null };

  if (error || !data) {
    return { success: false, message: error?.message ?? "Failed to create task" };
  }

  revalidatePath("/dashboard/tasks", "layout");
  return { success: true, message: "Task created", id: data.id };
}

// ─── Update task status ───────────────────────────────────────────────────────

export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  note?: string,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated" };

  const updates: Record<string, unknown> = {
    status:     newStatus,
    updated_at: new Date().toISOString(),
  };
  if (newStatus === "completed") updates.completed_at = new Date().toISOString();

  const { error } = await db
    .from("tasks")
    .update(updates)
    .eq("id", taskId) as { error: { message: string } | null };

  if (error) return { success: false, message: error.message };

  // Write audit log
  await db.from("audit_logs").insert({
    user_id:    user.id,
    action:     `task_status_changed_to_${newStatus}`,
    table_name: "tasks",
    record_id:  taskId,
    new_data:   { status: newStatus, note },
  });

  revalidatePath("/dashboard/tasks", "layout");
  return { success: true, message: `Task marked as ${newStatus}` };
}

// ─── Escalate task ────────────────────────────────────────────────────────────

export async function escalateTask(
  taskId: string,
  escalateTo: string, // user_id of escalation target
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated" };

  const { error } = await db
    .from("tasks")
    .update({
      assigned_to: escalateTo,
      priority:    "urgent",
      updated_at:  new Date().toISOString(),
    })
    .eq("id", taskId) as { error: { message: string } | null };

  if (error) return { success: false, message: error.message };

  await db.from("audit_logs").insert({
    user_id:    user.id,
    action:     "task_escalated",
    table_name: "tasks",
    record_id:  taskId,
    new_data:   { escalated_to: escalateTo, escalated_by: user.id },
  });

  revalidatePath("/dashboard/tasks", "layout");
  return { success: true, message: "Task escalated" };
}
