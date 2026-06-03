-- ============================================================
-- Robotek FinOS — Sales OS: Email templates (email channel)
-- Migration: 014_crm_email
-- ============================================================

create table public.crm_email_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  subject     text not null,
  body        text not null,              -- supports {{name}} / {{company}}
  category    text,
  is_active   boolean not null default true,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_crm_email_templates_active on public.crm_email_templates (is_active);

alter table public.crm_email_templates enable row level security;
create policy "crm_email_templates_select" on public.crm_email_templates for select to authenticated using (true);
create policy "crm_email_templates_insert" on public.crm_email_templates for insert to authenticated with check (public.can_write_crm());
create policy "crm_email_templates_update" on public.crm_email_templates for update to authenticated using (public.can_write_crm()) with check (public.can_write_crm());

create trigger crm_email_templates_updated_at before update on public.crm_email_templates
  for each row execute function public.handle_updated_at();

grant select, insert, update on public.crm_email_templates to authenticated;
