-- ============================================================
-- Robotek FinOS — NBD: Chatter (timeline), lost reasons, deal priority
-- Migration: 020_crm_chatter
-- ============================================================
-- Odoo-parity: a chatter/timeline per lead & deal (log notes + auto-logged
-- events), a customizable lost-reason list, and priority on deals
-- (COLD/MEDIUM/HOT, matching leads).

-- ── Deal priority + lost reason FK ──
alter table public.crm_deals add column if not exists priority text;

create table if not exists public.crm_lost_reasons (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.crm_lost_reasons enable row level security;
do $$ begin
  create policy "crm_lost_reasons_select" on public.crm_lost_reasons for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "crm_lost_reasons_insert" on public.crm_lost_reasons for insert to authenticated with check (public.can_write_crm());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "crm_lost_reasons_update" on public.crm_lost_reasons for update to authenticated using (public.can_write_crm()) with check (public.can_write_crm());
exception when duplicate_object then null; end $$;
grant select, insert, update on public.crm_lost_reasons to authenticated;

insert into public.crm_lost_reasons (name, sort_order)
select * from (values
  ('Too expensive', 1), ('Bought from competitor', 2), ('No budget', 3),
  ('No response', 4), ('Not a fit', 5), ('Bad timing', 6)
) as v(name, sort_order)
where not exists (select 1 from public.crm_lost_reasons);

alter table public.crm_deals add column if not exists lost_reason_id uuid references public.crm_lost_reasons(id) on delete set null;

-- ── Chatter messages ──
create table if not exists public.crm_messages (
  id          uuid primary key default gen_random_uuid(),
  parent_type text not null,                 -- 'lead' | 'deal' | 'account'
  parent_id   uuid not null,
  author_id   uuid references public.users(id) on delete set null,
  kind        text not null default 'note',  -- 'note' | 'log' | 'message'
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_crm_messages_parent on public.crm_messages (parent_type, parent_id, created_at desc);

alter table public.crm_messages enable row level security;
do $$ begin
  create policy "crm_messages_select" on public.crm_messages for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "crm_messages_insert" on public.crm_messages for insert to authenticated with check (public.can_write_crm());
exception when duplicate_object then null; end $$;
grant select, insert on public.crm_messages to authenticated;
