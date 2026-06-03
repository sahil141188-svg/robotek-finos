-- ============================================================
-- Robotek FinOS — Sales OS: Products catalog + Quotations (CPQ)
-- Migration: 013_crm_quotes
-- ============================================================

create type crm_quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');

-- ── CRM_PRODUCTS ────────────────────────────────────────────

create table public.crm_products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sku         text,
  category    text,
  hsn         text,                                   -- HSN code for GST
  unit        text not null default 'pcs',
  unit_price  numeric(15, 2) not null default 0,
  gst_rate    numeric(5, 2) not null default 18,      -- %
  is_active   boolean not null default true,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_crm_products_active on public.crm_products (is_active);
create index idx_crm_products_name   on public.crm_products (name);

alter table public.crm_products enable row level security;
create policy "crm_products_select" on public.crm_products for select to authenticated using (true);
create policy "crm_products_insert" on public.crm_products for insert to authenticated with check (public.can_write_crm());
create policy "crm_products_update" on public.crm_products for update to authenticated using (public.can_write_crm()) with check (public.can_write_crm());

-- ── CRM_QUOTES ──────────────────────────────────────────────

create table public.crm_quotes (
  id            uuid primary key default gen_random_uuid(),
  quote_number  text not null,
  account_id    uuid references public.crm_accounts(id) on delete set null,
  deal_id       uuid references public.crm_deals(id) on delete set null,
  status        crm_quote_status not null default 'draft',
  subtotal      numeric(15, 2) not null default 0,
  tax_total     numeric(15, 2) not null default 0,
  total         numeric(15, 2) not null default 0,
  valid_until   date,
  notes         text,
  terms         text,
  owner_id      uuid references public.users(id) on delete set null,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_crm_quotes_account on public.crm_quotes (account_id);
create index idx_crm_quotes_status  on public.crm_quotes (status);

alter table public.crm_quotes enable row level security;
create policy "crm_quotes_select" on public.crm_quotes for select to authenticated using (true);
create policy "crm_quotes_insert" on public.crm_quotes for insert to authenticated with check (public.can_write_crm());
create policy "crm_quotes_update" on public.crm_quotes for update to authenticated using (public.can_write_crm()) with check (public.can_write_crm());

-- ── CRM_QUOTE_ITEMS ─────────────────────────────────────────

create table public.crm_quote_items (
  id            uuid primary key default gen_random_uuid(),
  quote_id      uuid not null references public.crm_quotes(id) on delete cascade,
  product_id    uuid references public.crm_products(id) on delete set null,
  description   text not null,
  qty           numeric(15, 2) not null default 1,
  unit_price    numeric(15, 2) not null default 0,
  gst_rate      numeric(5, 2) not null default 18,
  line_subtotal numeric(15, 2) not null default 0,
  line_tax      numeric(15, 2) not null default 0,
  line_total    numeric(15, 2) not null default 0,
  sort_order    integer not null default 0
);

create index idx_crm_quote_items_quote on public.crm_quote_items (quote_id);

alter table public.crm_quote_items enable row level security;
create policy "crm_quote_items_select" on public.crm_quote_items for select to authenticated using (true);
create policy "crm_quote_items_insert" on public.crm_quote_items for insert to authenticated with check (public.can_write_crm());
create policy "crm_quote_items_update" on public.crm_quote_items for update to authenticated using (public.can_write_crm()) with check (public.can_write_crm());

-- ── TRIGGERS + GRANTS ───────────────────────────────────────

create trigger crm_products_updated_at before update on public.crm_products
  for each row execute function public.handle_updated_at();
create trigger crm_quotes_updated_at before update on public.crm_quotes
  for each row execute function public.handle_updated_at();

grant select, insert, update on public.crm_products    to authenticated;
grant select, insert, update on public.crm_quotes      to authenticated;
grant select, insert, update on public.crm_quote_items to authenticated;
