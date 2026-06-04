-- ============================================================
-- Robotek FinOS — NBD: meetings (physical / Zoom) with Sales Expert / FSR
-- Migration: 017_crm_meetings
-- ============================================================
-- One-touch: an SC assigns a lead + schedules a physical or Zoom meeting with
-- a Sales Expert or FSR. The assignee sees the full lead info, meeting time,
-- and conversation details.

create type crm_meeting_mode   as enum ('physical', 'zoom', 'phone');
create type crm_meeting_status as enum ('scheduled', 'done', 'cancelled', 'no_show');

create table public.crm_meetings (
  id                 uuid primary key default gen_random_uuid(),
  lead_id            uuid references public.crm_leads(id)    on delete cascade,
  account_id         uuid references public.crm_accounts(id) on delete set null,
  assigned_to        uuid references public.users(id) on delete set null,  -- Sales Expert / FSR
  arranged_by        uuid references public.users(id) on delete set null,  -- the SC who set it up
  mode               crm_meeting_mode   not null default 'physical',
  scheduled_at       timestamptz not null,
  location           text,                 -- for physical meetings
  meeting_link       text,                 -- for zoom / online
  agenda             text,
  conversation_notes text,                 -- what was discussed with the lead so far
  status             crm_meeting_status not null default 'scheduled',
  outcome            text,                 -- filled after the meeting
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_crm_meetings_assigned  on public.crm_meetings (assigned_to);
create index idx_crm_meetings_lead      on public.crm_meetings (lead_id);
create index idx_crm_meetings_when      on public.crm_meetings (scheduled_at);
create index idx_crm_meetings_status    on public.crm_meetings (status);

alter table public.crm_meetings enable row level security;
create policy "crm_meetings_select" on public.crm_meetings for select to authenticated using (true);
create policy "crm_meetings_insert" on public.crm_meetings for insert to authenticated with check (public.can_write_crm());
create policy "crm_meetings_update" on public.crm_meetings for update to authenticated using (public.can_write_crm()) with check (public.can_write_crm());

create trigger crm_meetings_updated_at before update on public.crm_meetings
  for each row execute function public.handle_updated_at();

grant select, insert, update on public.crm_meetings to authenticated;
