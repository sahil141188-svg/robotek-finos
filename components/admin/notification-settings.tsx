"use client";

/**
 * NotificationSettings — tabbed settings panel for:
 *   1. WhatsApp API configuration (saved to DB, ready for credentials)
 *   2. Email / SMTP configuration (saved to DB)
 *   3. Reminder schedule rules (saved to DB)
 *   4. Message templates (saved to DB)
 *   5. Notification log — sent / failed history
 *
 * Replaces the previous localStorage implementation.
 * Settings are persisted in Supabase app_settings table.
 */

import { useState, useEffect, useTransition } from "react";
import { Input }     from "@/components/ui/input";
import { Label }     from "@/components/ui/label";
import { Button }    from "@/components/ui/button";
import { Switch }    from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea }  from "@/components/ui/textarea";
import { Badge }     from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Mail, MessageSquare, Bell, FileText, History,
  CheckCircle2, AlertCircle, Eye, EyeOff, Send, Loader2,
} from "lucide-react";
import { cn }     from "@/lib/utils";
import { toast }  from "sonner";
import {
  getNotificationSettings,
  saveNotificationSettings,
  sendTestWhatsApp,
  getNotificationLog,
  type AllNotificationSettings,
  type NotificationLogEntry,
} from "@/app/actions/notification-settings";

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "whatsapp",  label: "WhatsApp",          icon: MessageSquare },
  { id: "email",     label: "Email / SMTP",       icon: Mail },
  { id: "reminders", label: "Reminder Rules",     icon: Bell },
  { id: "templates", label: "Message Templates",  icon: FileText },
  { id: "log",       label: "Notification Log",   icon: History },
] as const;
type TabId = (typeof TABS)[number]["id"];

// ── Template variable helper ──────────────────────────────────────────────────

const TEMPLATE_VARS = {
  ar_reminder:          ["{customer_name}", "{invoice_no}", "{amount}", "{due_date}", "{company_name}"],
  compliance_reminder:  ["{user_name}", "{compliance_title}", "{due_date}", "{urgency}"],
  task_reminder:        ["{user_name}", "{task_title}", "{due_date}", "{priority}", "{days_label}"],
} as const;

// ── DayChips ──────────────────────────────────────────────────────────────────

function DayChips({
  label, value, onChange, options,
}: {
  label: string; value: number[]; onChange: (v: number[]) => void; options: number[];
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((day) => (
          <button
            key={day} type="button"
            onClick={() => onChange(
              value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => b - a)
            )}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              value.includes(day)
                ? "bg-brand-red text-white border-brand-red"
                : "bg-white text-brand-gray-mid border-border hover:border-brand-gray-mid",
            )}
          >
            {day === 0 ? "Day of" : `${day}d before`}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Active: {value.length === 0 ? "none" : value.map((d) => d === 0 ? "day-of" : `${d}d`).join(", ")}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationSettings() {
  const [activeTab, setActiveTab] = useState<TabId>("whatsapp");
  const [loading,   setLoading]   = useState(true);
  const [isPending, startTransition] = useTransition();

  // Settings state
  const [settings, setSettings] = useState<AllNotificationSettings | null>(null);

  // WhatsApp test
  const [testPhone,   setTestPhone]   = useState("");
  const [testPending, setTestPending] = useState(false);

  // Log
  const [log,        setLog]        = useState<NotificationLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  // Password visibility
  const [showSmtpPwd,  setShowSmtpPwd]  = useState(false);
  const [showWaToken,  setShowWaToken]  = useState(false);

  // Load settings from DB on mount
  useEffect(() => {
    getNotificationSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  // Load log when switching to log tab
  useEffect(() => {
    if (activeTab !== "log") return;
    setLogLoading(true);
    getNotificationLog(100).then((entries) => {
      setLog(entries);
      setLogLoading(false);
    });
  }, [activeTab]);

  function updateWhatsapp(patch: Partial<AllNotificationSettings["whatsapp"]>) {
    setSettings((s) => s ? { ...s, whatsapp: { ...s.whatsapp, ...patch } } : s);
  }
  function updateEmail(patch: Partial<AllNotificationSettings["email"]>) {
    setSettings((s) => s ? { ...s, email: { ...s.email, ...patch } } : s);
  }
  function updateReminders(patch: Partial<AllNotificationSettings["reminders"]>) {
    setSettings((s) => s ? { ...s, reminders: { ...s.reminders, ...patch } } : s);
  }
  function updateTemplates(patch: Partial<AllNotificationSettings["templates"]>) {
    setSettings((s) => s ? { ...s, templates: { ...s.templates, ...patch } } : s);
  }

  function handleSave() {
    if (!settings) return;
    startTransition(async () => {
      const result = await saveNotificationSettings(settings);
      if (result.success) {
        toast.success("Settings saved to database");
      } else {
        toast.error(result.error ?? "Save failed");
      }
    });
  }

  async function handleTestWhatsApp() {
    // For Meta the meta_phone_id is a numeric API ID (not a phone), so we can
    // only fall back to it for backwards compat. Maytapi & Twilio always need
    // an explicit recipient — sender numbers aren't meaningful as recipients.
    const phone = testPhone.trim()
      || (settings?.whatsapp.provider === "meta" ? settings?.whatsapp.meta_phone_id : "");
    if (!phone) { toast.error("Enter a phone number to test (with country code, e.g. +91…)"); return; }
    setTestPending(true);
    try {
      const result = await sendTestWhatsApp(phone);
      if (result.sent) {
        toast.success("Test message sent! Check your WhatsApp.");
      } else if (result.skipped) {
        toast.info("WhatsApp credentials not configured yet — dry-run logged.");
      } else {
        toast.error(result.error ?? "Send failed");
      }
    } finally {
      setTestPending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-brand-red" />
        <span className="ml-2 text-sm text-brand-gray-mid">Loading settings…</span>
      </div>
    );
  }

  if (!settings) return null;

  const { whatsapp, email, reminders, templates } = settings;

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id} type="button" onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === id
                ? "bg-brand-red text-white"
                : "bg-white border border-border text-brand-gray-mid hover:text-brand-black",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── WhatsApp ─────────────────────────────────────────────────────── */}
      {activeTab === "whatsapp" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-green-600" /> WhatsApp API Configuration
              </h2>
              <div className="flex items-center gap-2">
                <Switch
                  checked={whatsapp.enabled}
                  onCheckedChange={(v) => updateWhatsapp({ enabled: v })}
                />
                <span className="text-xs font-medium">{whatsapp.enabled ? "Enabled" : "Disabled"}</span>
              </div>
            </div>

            {/* Provider selector */}
            <div className="space-y-1.5">
              <Label>WhatsApp Provider</Label>
              <Select
                value={whatsapp.provider}
                onValueChange={(v) => { if (v === "meta" || v === "twilio" || v === "maytapi") updateWhatsapp({ provider: v }); }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta Cloud API (official Business API)</SelectItem>
                  <SelectItem value="maytapi">Maytapi (third-party gateway)</SelectItem>
                  <SelectItem value="twilio">Twilio WhatsApp Business API</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Meta fields */}
            {whatsapp.provider === "meta" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Meta Access Token (permanent token from Meta Business Manager)</Label>
                  <div className="relative">
                    <Input
                      type={showWaToken ? "text" : "password"}
                      value={whatsapp.meta_token}
                      onChange={(e) => updateWhatsapp({ meta_token: e.target.value })}
                      placeholder="EAAxxxxxxxxxx… (paste when you have it)"
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowWaToken((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray-mid hover:text-brand-black">
                      {showWaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Phone Number ID (from Meta Developer Console → WhatsApp → Getting Started)</Label>
                  <Input
                    value={whatsapp.meta_phone_id}
                    onChange={(e) => updateWhatsapp({ meta_phone_id: e.target.value })}
                    placeholder="123456789012345"
                  />
                </div>
              </div>
            )}

            {/* Maytapi fields */}
            {whatsapp.provider === "maytapi" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Product ID (from Maytapi dashboard → Products)</Label>
                  <Input
                    value={whatsapp.maytapi_product_id ?? ""}
                    onChange={(e) => updateWhatsapp({ maytapi_product_id: e.target.value })}
                    placeholder="e.g. 12345 or UUID"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone ID (numeric ID of your connected WhatsApp phone in Maytapi)</Label>
                  <Input
                    value={whatsapp.maytapi_phone_id ?? ""}
                    onChange={(e) => updateWhatsapp({ maytapi_phone_id: e.target.value })}
                    placeholder="e.g. 34178"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>API Token (x-maytapi-key — from Maytapi → Account → API Token)</Label>
                  <div className="relative">
                    <Input
                      type={showWaToken ? "text" : "password"}
                      value={whatsapp.maytapi_token ?? ""}
                      onChange={(e) => updateWhatsapp({ maytapi_token: e.target.value })}
                      placeholder="Your Maytapi API token"
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowWaToken((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray-mid hover:text-brand-black">
                      {showWaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="sm:col-span-2 text-[11px] text-brand-gray-mid bg-brand-gray-light/50 rounded-lg p-3">
                  <p className="font-semibold text-brand-black mb-1">Where to find these in Maytapi</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Log in at <a href="https://console.maytapi.com" target="_blank" rel="noopener" className="text-brand-red underline">console.maytapi.com</a></li>
                    <li><strong>Product ID</strong> → Products section → copy the UUID of your product</li>
                    <li><strong>Phone ID</strong> → inside that product → your connected WhatsApp phone has a UUID listed</li>
                    <li><strong>API Token</strong> → Account settings → API Token tab</li>
                    <li>Make sure the phone shows status <strong>"connected"</strong> in Maytapi before testing</li>
                  </ol>
                  <p className="mt-2">No 24-hour window restriction (unlike Meta) — Maytapi can message any number anytime since it uses the WhatsApp Web bridge.</p>
                </div>
              </div>
            )}

            {/* Twilio fields */}
            {whatsapp.provider === "twilio" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Account SID</Label>
                  <Input
                    value={whatsapp.account_sid}
                    onChange={(e) => updateWhatsapp({ account_sid: e.target.value })}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Auth Token</Label>
                  <div className="relative">
                    <Input
                      type={showWaToken ? "text" : "password"}
                      value={whatsapp.auth_token}
                      onChange={(e) => updateWhatsapp({ auth_token: e.target.value })}
                      placeholder="Your Twilio auth token"
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowWaToken((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray-mid hover:text-brand-black">
                      {showWaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>From Number</Label>
                  <Input
                    value={whatsapp.from_number}
                    onChange={(e) => updateWhatsapp({ from_number: e.target.value })}
                    placeholder="whatsapp:+14155238886"
                  />
                </div>
              </div>
            )}

            {/* Status banner */}
            {!whatsapp.meta_token && !whatsapp.account_sid && !whatsapp.maytapi_token ? (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Credentials not yet configured</p>
                  <p className="mt-0.5">The app is fully built and ready. Paste your API credentials above and save — reminders will go live immediately. Until then, all WhatsApp sends are dry-run (logged but not actually sent).</p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <p className="font-semibold">Credentials configured — use the test button below to verify</p>
              </div>
            )}
          </div>

          {/* Test section */}
          <div className="bg-white rounded-xl border border-border p-5 space-y-3">
            <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2">
              <Send className="w-4 h-4 text-green-600" /> Send Test Message
            </h2>
            <p className="text-xs text-brand-gray-mid">
              Sends a test WhatsApp message to verify your API credentials. Works in dry-run mode too (logs but doesn&apos;t send).
            </p>
            <div className="flex gap-2">
              <div className="flex">
                <span className="flex items-center px-3 rounded-l-lg border border-r-0 border-border bg-brand-gray-light text-sm text-brand-gray-mid">+91</span>
                <Input
                  type="tel"
                  value={testPhone.replace(/^\+91/, "")}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setTestPhone(raw ? `+91${raw}` : "");
                  }}
                  placeholder="98765 43210"
                  maxLength={10}
                  className="rounded-l-none w-40"
                />
              </div>
              <Button
                type="button"
                onClick={handleTestWhatsApp}
                disabled={testPending}
                className="!bg-green-600 hover:!bg-green-700 !text-white"
              >
                {testPending
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Sending…</>
                  : <><Send className="w-3.5 h-3.5 mr-1.5" />Send Test</>
                }
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Email / SMTP ──────────────────────────────────────────────────── */}
      {activeTab === "email" && (
        <div className="bg-white rounded-xl border border-border p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2">
              <Mail className="w-4 h-4 text-brand-red" /> Email / SMTP Configuration
            </h2>
            <div className="flex items-center gap-2">
              <Switch checked={email.enabled} onCheckedChange={(v) => updateEmail({ enabled: v })} />
              <span className="text-xs font-medium">{email.enabled ? "Enabled" : "Disabled"}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Sender Name</Label>
              <Input value={email.sender_name} onChange={(e) => updateEmail({ sender_name: e.target.value })} placeholder="Robotek FinOS" />
            </div>
            <div className="space-y-1.5">
              <Label>From Email</Label>
              <Input type="email" value={email.from_email} onChange={(e) => updateEmail({ from_email: e.target.value })} placeholder="noreply@robotek.in" />
            </div>
            <div className="space-y-1.5">
              <Label>SMTP Host</Label>
              <Input value={email.smtp_host} onChange={(e) => updateEmail({ smtp_host: e.target.value })} placeholder="smtp.gmail.com" />
            </div>
            <div className="space-y-1.5">
              <Label>SMTP Port</Label>
              <Input value={email.smtp_port} onChange={(e) => updateEmail({ smtp_port: e.target.value })} placeholder="587" />
            </div>
            <div className="space-y-1.5">
              <Label>SMTP Username</Label>
              <Input value={email.smtp_user} onChange={(e) => updateEmail({ smtp_user: e.target.value })} placeholder="your@gmail.com" />
            </div>
            <div className="space-y-1.5">
              <Label>SMTP Password</Label>
              <div className="relative">
                <Input
                  type={showSmtpPwd ? "text" : "password"}
                  value={email.smtp_password}
                  onChange={(e) => updateEmail({ smtp_password: e.target.value })}
                  placeholder="App password"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowSmtpPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray-mid hover:text-brand-black">
                  {showSmtpPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={email.use_tls} onCheckedChange={(v) => updateEmail({ use_tls: v })} />
            <label className="text-sm">Use TLS/STARTTLS encryption</label>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
            <strong>Gmail tip:</strong> Enable 2-FA → generate an App Password at myaccount.google.com → Security → App Passwords.
          </div>
        </div>
      )}

      {/* ── Reminder Rules ────────────────────────────────────────────────── */}
      {activeTab === "reminders" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border p-5 space-y-4">
            <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-red" /> Compliance Reminders
            </h2>
            <DayChips
              label="Send reminders on these days before due date"
              value={reminders.compliance_days_before}
              onChange={(v) => updateReminders({ compliance_days_before: v })}
              options={[30, 14, 7, 3, 1, 0]}
            />
            <p className="text-xs text-muted-foreground">GST, TDS, TCS, Advance Tax, PF/ESI, ROC filings.</p>
          </div>

          <div className="bg-white rounded-xl border border-border p-5 space-y-4">
            <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" /> Task Due Reminders
            </h2>
            <DayChips
              label="Send reminders on these days before task due date"
              value={reminders.task_days_before}
              onChange={(v) => updateReminders({ task_days_before: v })}
              options={[14, 7, 3, 1, 0]}
            />
          </div>

          <div className="bg-white rounded-xl border border-border p-5 space-y-4">
            <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" /> Escalation
            </h2>
            <div className="space-y-1.5">
              <Label>Escalate to next role if not actioned within</Label>
              <Select
                value={String(reminders.escalation_hours)}
                onValueChange={(v) => updateReminders({ escalation_hours: Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 8, 12, 24, 48, 72].map((h) => (
                    <SelectItem key={h} value={String(h)}>{h} hours</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* ── Message Templates ─────────────────────────────────────────────── */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          {(["compliance_reminder", "task_reminder", "ar_reminder"] as const).map((key) => {
            const LABEL = {
              ar_reminder:         "AR Payment Reminder (sent to customers)",
              compliance_reminder: "Compliance Due Reminder (sent to team via WhatsApp)",
              task_reminder:       "Task Due Reminder (sent to assignee via WhatsApp)",
            }[key];

            return (
              <div key={key} className="bg-white rounded-xl border border-border p-5 space-y-3">
                <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-red" /> {LABEL}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARS[key].map((v) => (
                    <span key={v} className="text-[10px] font-mono bg-brand-gray-light border border-border rounded px-1.5 py-0.5 text-brand-gray-mid">{v}</span>
                  ))}
                </div>
                <Textarea
                  value={templates[key]}
                  onChange={(e) => updateTemplates({ [key]: e.target.value })}
                  rows={7} className="font-mono text-xs resize-y"
                />
                <details className="group">
                  <summary className="text-xs text-brand-gray-mid cursor-pointer hover:text-brand-black flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Preview with sample data
                  </summary>
                  <div className="mt-2 p-3 bg-brand-gray-light/60 rounded-lg text-xs text-brand-black whitespace-pre-wrap font-mono border border-border">
                    {templates[key]
                      .replace("{customer_name}", "ABC Electronics Pvt Ltd")
                      .replace("{invoice_no}",    "INV-2026-04-001")
                      .replace("{amount}",        "₹2,45,000")
                      .replace("{due_date}",      "25 May 2026")
                      .replace("{company_name}",  "Robotek India Pvt Ltd")
                      .replace("{user_name}",     "Rahul Sharma")
                      .replace("{compliance_title}", "GSTR-3B — May 2026")
                      .replace("{urgency}",       "⏰ Due in 3 days")
                      .replace("{task_title}",    "Verify vendor invoices for April")
                      .replace("{priority}",      "High")
                      .replace("{days_label}",    "due in 3 days")}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Notification Log ──────────────────────────────────────────────── */}
      {activeTab === "log" && (
        <div className="bg-white rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2">
            <History className="w-4 h-4 text-brand-red" /> Notification History
          </h2>

          {logLoading && (
            <div className="flex items-center gap-2 text-sm text-brand-gray-mid">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading log…
            </div>
          )}

          {!logLoading && log.length === 0 && (
            <div className="text-center py-10">
              <History className="w-10 h-10 text-brand-gray-light mx-auto mb-3" />
              <p className="text-sm text-brand-gray-mid">No notifications sent yet.</p>
              <p className="text-xs text-brand-gray-mid mt-1">
                Send a test message or wait for the daily cron to run.
              </p>
            </div>
          )}

          {!logLoading && log.length > 0 && (
            <div className="divide-y divide-border">
              {log.map((entry) => (
                <div key={entry.id} className="py-3 flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    {entry.channel === "whatsapp"
                      ? <MessageSquare className="w-4 h-4 text-green-600" />
                      : <Mail className="w-4 h-4 text-blue-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-brand-black truncate">
                        {entry.subject ?? "—"}
                      </span>
                      <Badge
                        variant={entry.status === "sent" ? "default" : entry.status === "skipped" ? "secondary" : "destructive"}
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          entry.status === "sent"    && "!bg-green-100 !text-green-700 !border-green-200",
                          entry.status === "skipped" && "!bg-yellow-100 !text-yellow-700 !border-yellow-200",
                          entry.status === "failed"  && "!bg-red-100 !text-red-700 !border-red-200",
                        )}
                      >
                        {entry.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-brand-gray-mid mt-0.5 truncate">→ {entry.recipient}</p>
                    {entry.error && (
                      <p className="text-xs text-red-500 mt-0.5">{entry.error}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-brand-gray-mid shrink-0">
                    {new Date(entry.created_at).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Separator />

      {/* Save */}
      <div className="flex items-center gap-3 pb-6">
        <Button
          type="button" onClick={handleSave}
          className="!bg-brand-red hover:!bg-brand-maroon !text-white"
          disabled={isPending}
        >
          {isPending
            ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Saving…</>
            : <><CheckCircle2 className="w-4 h-4 mr-1.5" />Save Settings</>
          }
        </Button>
        <p className="text-xs text-brand-gray-mid">Settings are saved to the database and take effect immediately.</p>
      </div>
    </div>
  );
}
