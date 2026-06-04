-- ============================================================
-- Robotek FinOS — NBD: weekly performance targets per user
-- Migration: 019_crm_targets
-- ============================================================
-- One row per user per week (week_start = Monday). Actuals are computed live
-- from activities / meetings / lead conversions on the Performance dashboard.

create table public.crm_weekly_targets (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  week_start         date not null,
  followups_target   integer not null default 0,
  meetings_target    integer not null default 0,
  conversions_target integer not null default 0,
  value_target       numeric(15, 2) not null default 0,
  updated_by         uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, week_start)
);

create index idx_crm_weekly_targets_week on public.crm_weekly_targets (week_start);

alter table public.crm_weekly_targets enable row level security;
create policy "crm_targets_select" on public.crm_weekly_targets for select to authenticated using (true);
create policy "crm_targets_insert" on public.crm_weekly_targets for insert to authenticated with check (public.can_write_crm());
create policy "crm_targets_update" on public.crm_weekly_targets for update to authenticated using (public.can_write_crm()) with check (public.can_write_crm());

create trigger crm_weekly_targets_updated_at before update on public.crm_weekly_targets
  for each row execute function public.handle_updated_at();

grant select, insert, update on public.crm_weekly_targets to authenticated;
