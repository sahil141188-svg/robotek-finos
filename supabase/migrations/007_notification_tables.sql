-- ============================================================
-- Migration 007: Notification Infrastructure
-- app_settings — key/value store for SMTP + WhatsApp config
-- notification_log — audit trail of every sent notification
-- ============================================================

-- ── app_settings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;

-- ── notification_log ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_log (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  channel    text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  recipient  text NOT NULL,
  subject    text,
  body       text NOT NULL,
  status     text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error      text,
  metadata   jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_log_user    ON public.notification_log (user_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_channel ON public.notification_log (channel);
CREATE INDEX IF NOT EXISTS idx_notif_log_status  ON public.notification_log (status);
CREATE INDEX IF NOT EXISTS idx_notif_log_created ON public.notification_log (created_at DESC);

GRANT SELECT, INSERT ON public.notification_log TO authenticated;

-- ── Seed default settings rows ────────────────────────────
INSERT INTO public.app_settings (key, value) VALUES
  ('whatsapp', '{"enabled":false,"provider":"meta","account_sid":"","auth_token":"","from_number":"","meta_token":"","meta_phone_id":""}'),
  ('email',    '{"enabled":true,"sender_name":"Robotek FinOS","from_email":"noreply@robotek.in","smtp_host":"smtp.gmail.com","smtp_port":"587","smtp_user":"","smtp_password":"","use_tls":true}'),
  ('reminders','{"compliance_days_before":[14,7,3,1],"task_days_before":[7,3,1],"ar_days_before_due":3,"ar_days_after_due":1,"escalation_hours":24}'),
  ('templates', '{"ar_reminder":"Dear {customer_name},\n\nThis is a reminder that invoice {invoice_no} for ₹{amount} is due on {due_date}.\n\nPlease arrange payment at the earliest.\n\nRegards,\n{company_name} Finance Team","compliance_reminder":"Hi {user_name},\n\nAction required: {compliance_title} is due on {due_date}.\n\nPlease complete this filing on time to avoid penalties.\n\nRobotek FinOS — Compliance Calendar","task_reminder":"Hi {user_name},\n\nReminder: Task \"{task_title}\" assigned to you is due on {due_date}.\n\nPlease update the status on Robotek FinOS.\n\nPriority: {priority}"}')
ON CONFLICT (key) DO NOTHING;
