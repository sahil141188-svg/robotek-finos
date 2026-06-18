/**
 * Design OS — Deadline Reminders API
 * GET /api/design-os/reminders
 * Returns tasks with deadline within 3 days that are not final_approved.
 * Secured by Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  // Auth check
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;

  const today = new Date();
  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(today.getDate() + 3);

  const todayStr = today.toISOString().split("T")[0];
  const limitStr = threeDaysLater.toISOString().split("T")[0];

  const { data: tasks, error } = await db
    .from("design_tasks")
    .select("id, title, assigned_to, deadline")
    .not("status", "eq", "final_approved")
    .not("deadline", "is", null)
    .lte("deadline", limitStr)
    .order("deadline", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = ((tasks ?? []) as {
    id: string; title: string; assigned_to: string; deadline: string;
  }[]).map((t) => {
    const deadlineDate = new Date(t.deadline);
    const msPerDay = 1000 * 60 * 60 * 24;
    const days_until = Math.ceil((deadlineDate.getTime() - new Date(todayStr).getTime()) / msPerDay);
    return { id: t.id, title: t.title, assigned_to: t.assigned_to, deadline: t.deadline, days_until };
  });

  return NextResponse.json({ count: result.length, tasks: result });
}
