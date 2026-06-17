-- ============================================================
-- Robotek FinOS — CRM: Align with Sales Funnel Flowchart
-- Migration: 022_crm_funnel_alignment
-- Changes:
--   1. Lead statuses: add docs_pending, hold, rejected
--   2. Deal stages: add assigned, follow_up (keep old for migration)
--   3. Lead docs fields: shop_photo_ok, visiting_card_ok, gst_number
--   4. Deal followup_count: track calls/WA against 30-follow-up cap
-- ============================================================

-- 1. Extend crm_lead_status enum
alter type public.crm_lead_status add value if not exists 'docs_pending';
alter type public.crm_lead_status add value if not exists 'hold';
alter type public.crm_lead_status add value if not exists 'rejected';

-- 2. Extend crm_deal_stage enum
alter type public.crm_deal_stage add value if not exists 'assigned';
alter type public.crm_deal_stage add value if not exists 'follow_up';

-- 3. Docs collection fields on crm_leads
alter table public.crm_leads
  add column if not exists shop_photo_ok    boolean not null default false,
  add column if not exists visiting_card_ok boolean not null default false,
  add column if not exists gst_number       text;

-- 4. Follow-up counter on crm_deals (cumulative calls + WA messages)
alter table public.crm_deals
  add column if not exists followup_count integer not null default 0;

-- 5. Trigger: auto-increment followup_count when a call/whatsapp activity
--    is inserted against a deal and marked done
create or replace function public.crm_increment_deal_followup()
returns trigger language plpgsql as $$
begin
  if NEW.deal_id is not null and NEW.type in ('call', 'whatsapp') then
    update public.crm_deals
    set followup_count = followup_count + 1
    where id = NEW.deal_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_crm_deal_followup on public.crm_activities;
create trigger trg_crm_deal_followup
  after insert on public.crm_activities
  for each row execute function public.crm_increment_deal_followup();

-- 6. Migrate existing open deals to new stages:
--    new → assigned, qualified/quoted → follow_up
update public.crm_deals set stage = 'assigned'  where stage = 'new';
update public.crm_deals set stage = 'follow_up' where stage in ('qualified', 'quoted', 'negotiation');
