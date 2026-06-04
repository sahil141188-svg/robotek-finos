/**
 * Sales OS — team performance (company + per-user) for a given week, with
 * targets vs live actuals. Actuals are derived from activities, meetings, and
 * lead conversions. Server-only.
 */
import { createClient } from "@/lib/supabase/server";

async function db(): Promise<any> {
  return (await createClient()) as any;
}

export type Targets = { followups: number; meetings: number; conversions: number; value: number };
export type Actuals = { followups: number; meetings: number; conversions: number; value: number; openLeads: number };

export type UserPerf = {
  userId: string;
  name: string;
  department: string | null;
  teamRole: string | null;
  targets: Targets;
  actuals: Actuals;
};

export type Performance = {
  weekStart: string;       // YYYY-MM-DD (Monday)
  weekEnd: string;
  users: UserPerf[];
  company: {
    targets: Targets;
    actuals: Actuals;
    salesPeople: number;
  };
};

/** Monday (local) of the week containing `d`, as YYYY-MM-DD. */
export function weekStartOf(d: Date): string {
  const day = d.getDay();              // 0 Sun … 6 Sat
  const diff = (day + 6) % 7;          // days since Monday
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getPerformance(weekStart: string): Promise<Performance> {
  const sb = await db();
  const weekEnd = addDaysISO(weekStart, 7);
  const from = `${weekStart}T00:00:00`;
  const to = `${weekEnd}T00:00:00`;

  const [{ data: users }, { data: targets }, { data: acts }, { data: meetings }, { data: conv }, { data: openLeads }] =
    await Promise.all([
      sb.from("users").select("id, full_name, crm_department, crm_team_role").not("crm_team_role", "is", null).eq("is_active", true).order("full_name"),
      sb.from("crm_weekly_targets").select("*").eq("week_start", weekStart),
      sb.from("crm_activities").select("owner_id").eq("done", true).gte("done_at", from).lt("done_at", to),
      sb.from("crm_meetings").select("assigned_to, status, scheduled_at").gte("scheduled_at", from).lt("scheduled_at", to),
      sb.from("crm_leads").select("assigned_to, first_billing_amount, converted_at").not("converted_at", "is", null).gte("converted_at", from).lt("converted_at", to),
      sb.from("crm_leads").select("assigned_to").is("converted_at", null).neq("status", "unqualified"),
    ]);

  const count = (rows: any[], key: string) => {
    const m = new Map<string, number>();
    (rows ?? []).forEach((r) => { const k = r[key]; if (k) m.set(k, (m.get(k) ?? 0) + 1); });
    return m;
  };

  const followupsBy = count(acts ?? [], "owner_id");
  const meetingsBy = count((meetings ?? []).filter((m: any) => m.status === "done"), "assigned_to");
  const convBy = count(conv ?? [], "assigned_to");
  const openBy = count(openLeads ?? [], "assigned_to");
  const valueBy = new Map<string, number>();
  (conv ?? []).forEach((r: any) => { if (r.assigned_to) valueBy.set(r.assigned_to, (valueBy.get(r.assigned_to) ?? 0) + (Number(r.first_billing_amount) || 0)); });

  const targetBy = new Map<string, any>();
  (targets ?? []).forEach((t: any) => targetBy.set(t.user_id, t));

  const userPerf: UserPerf[] = (users ?? []).map((u: any) => {
    const t = targetBy.get(u.id);
    return {
      userId: u.id,
      name: u.full_name,
      department: u.crm_department,
      teamRole: u.crm_team_role,
      targets: {
        followups: t?.followups_target ?? 0,
        meetings: t?.meetings_target ?? 0,
        conversions: t?.conversions_target ?? 0,
        value: Number(t?.value_target) || 0,
      },
      actuals: {
        followups: followupsBy.get(u.id) ?? 0,
        meetings: meetingsBy.get(u.id) ?? 0,
        conversions: convBy.get(u.id) ?? 0,
        value: valueBy.get(u.id) ?? 0,
        openLeads: openBy.get(u.id) ?? 0,
      },
    };
  });

  const sum = (sel: (u: UserPerf) => number) => userPerf.reduce((s, u) => s + sel(u), 0);
  return {
    weekStart,
    weekEnd,
    users: userPerf,
    company: {
      targets: {
        followups: sum((u) => u.targets.followups),
        meetings: sum((u) => u.targets.meetings),
        conversions: sum((u) => u.targets.conversions),
        value: sum((u) => u.targets.value),
      },
      actuals: {
        followups: sum((u) => u.actuals.followups),
        meetings: sum((u) => u.actuals.meetings),
        conversions: sum((u) => u.actuals.conversions),
        value: sum((u) => u.actuals.value),
        openLeads: sum((u) => u.actuals.openLeads),
      },
      salesPeople: userPerf.length,
    },
  };
}
