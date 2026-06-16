-- Add price_tier to users for customer-facing price list access
-- null = internal staff (sees all tiers), set = customer (sees only their tier)

alter table public.users
  add column if not exists price_tier text
    check (price_tier in ('ss', 'dd', 'dealer'));
