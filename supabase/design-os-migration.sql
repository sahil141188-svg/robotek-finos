-- Design OS Module Migration
-- Run this in Supabase SQL editor

-- ── design_tasks: created by management, assigned to a designer ──
create table if not exists design_tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  task_type     text not null,          -- e.g. Social Post, Banner, Brochure, Video
  platform      text,                   -- e.g. Instagram, Facebook, Print
  assigned_to   text not null,          -- "vishal" | "nitin" | "both"
  deadline      date,
  priority      text default 'medium',  -- low | medium | high | urgent
  reference_url text,
  notes         text,
  created_by    uuid references users(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── design_submissions: each round of upload/review ──
create table if not exists design_submissions (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid references design_tasks(id) on delete cascade,
  round         int not null default 1,
  submitted_by  text not null,           -- "vishal" | "nitin"
  submitted_at  timestamptz default now(),
  status        text not null default 'pending_review',
  -- pending_review | approved | needs_correction | final_approved | rejected
  reviewer_note text,
  reviewed_by   text,
  reviewed_at   timestamptz,
  final_note    text,
  final_by      uuid references users(id),
  final_at      timestamptz
);

-- ── design_files: files attached to a submission ──
create table if not exists design_files (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid references design_submissions(id) on delete cascade,
  file_name      text not null,
  file_url       text not null,
  file_type      text,  -- image | pdf | video | other
  file_size      bigint,
  uploaded_at    timestamptz default now()
);

-- Enable RLS (all authenticated users can read; insert controlled by app logic)
alter table design_tasks        enable row level security;
alter table design_submissions  enable row level security;
alter table design_files        enable row level security;

-- Allow all authenticated users full access (app enforces role logic)
create policy "auth_all_design_tasks"       on design_tasks       for all using (auth.role() = 'authenticated');
create policy "auth_all_design_submissions" on design_submissions  for all using (auth.role() = 'authenticated');
create policy "auth_all_design_files"       on design_files        for all using (auth.role() = 'authenticated');

-- Storage bucket for design files (run separately or via Supabase dashboard)
-- insert into storage.buckets (id, name, public) values ('design-files', 'design-files', false);
-- create policy "design_files_upload" on storage.objects for insert with check (bucket_id = 'design-files' and auth.role() = 'authenticated');
-- create policy "design_files_read"   on storage.objects for select using (bucket_id = 'design-files' and auth.role() = 'authenticated');
