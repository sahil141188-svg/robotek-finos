"use client";

/**
 * NotificationSettings — tabbed settings panel for:
 *   1. Email (SMTP) configuration
 *   2. WhatsApp API configuration
 *   3. Reminder schedule rules
 *   4. Message templates
 *
 * All settings are persisted in localStorage for the demo.
 * In production these would be stored in Supabase app_settings.
 */

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail, MessageSquare, Bell, FileText,
  CheckCircle2, AlertCircle, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Default settings ─────────────────────────────────────────────────────────

const DEFAULT_EMAIL = {
  enabled:      true,
  sender_name:  "Robotek FinOS",
  from_email:   "noreply@robotek.in",
  smtp_host:    "smtp.gmail.com",
  smtp_port:    "587",
  smtp_user:    "",
  smtp_password:"",
  use_tls:      true,
};

const DEFAULT_WHATSAPP = {
  enabled:      false,
  provider:     "twilio",   // "twilio" | "meta"
  account_sid:  "",
  auth_token:   "",
  from_number:  "",
  meta_token:   "",
  meta_phone_id:"",
};

const DEFAULT_REMINDERS = {
  compliance_days_before: [14, 7, 3, 1],
  task_days_before:       [7, 3, 1],
  ar_days_before_due:     3,
  ar_days_after_due:      1,
  escalation_hours:       24,
};

const DEFAULT_TEMPLATES = {
  ar_reminder: `Dear {customer_name},

This is a reminder that invoice {invoice_no} for ₹{amount} is due on {due_date}.

Please arrange payment at the earliest.

Regards,
{company_name} Finance Team`,

  compliance_reminder: `Hi {user_name},

Action required: {compliance_title} is due on {due_date}.

Please complete this filing on time to avoid penalties.

Robotek FinOS — Compliance Calendar`,

  task_reminder: `Hi {user_name},

Reminder: Task "{task_title}" assigned to you is due on {due_date}.

Please update the status on Robotek FinOS.

Priority: {priority}`,
};

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "email",     label: "Email / SMTP",     icon: Mail },
  { id: "whatsapp",  label: "WhatsApp",          icon: MessageSquare },
  { id: "reminders", label: "Reminder Rules",    icon: Bell },
  { id: "templates", label: "Message Templates", icon: FileText },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Template variable helper ──────────────────────────────────────────────────

const TEMPLATE_VARS: Record<"ar_reminder" | "compliance_reminder" | "task_reminder", string[]> = {
  ar_reminder:           ["{customer_name}", "{invoice_no}", "{amount}", "{due_date}", "{company_name}"],
  compliance_reminder:   ["{user_name}", "{compliance_title}", "{due_date}"],
  task_reminder:         ["{user_name}", "{task_title}", "{due_date}", "{priority}"],
};

// ── Helper: DayChips — pill buttons for selecting reminder day offsets ────────

function DayChips({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: number[];
  onChange: (v: number[]) => void;
  options: number[];
}) {
  function toggle(day: number) {
    onChange(
      value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => b - a)
    );
  }
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              value.includes(day)
                ? "bg-brand-red text-white border-brand-red"
                : "bg-white text-brand-gray-mid border-border hover:border-brand-gray-mid"
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
  const [activeTab, setActiveTab] = useState<TabId>("email");

  // State for each settings section
  const [email,      setEmail]      = useState(DEFAULT_EMAIL);
  const [whatsapp,   setWhatsapp]   = useState(DEFAULT_WHATSAPP);
  const [reminders,  setReminders]  = useState(DEFAULT_REMINDERS);
  const [templates,  setTemplates]  = useState(DEFAULT_TEMPLATES);

  const [showSmtpPwd, setShowSmtpPwd] = useState(false);
  const [showWaToken, setShowWaToken] = useState(false);
  const [saved, setSaved]             = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const e = localStorage.getItem("rk_notif_email");
      const w = localStorage.getItem("rk_notif_whatsapp");
      const r = localStorage.getItem("rk_notif_reminders");
      const t = localStorage.getItem("rk_notif_templates");
      if (e) setEmail(JSON.parse(e));
      if (w) setWhatsapp(JSON.parse(w));
      if (r) setReminders(JSON.parse(r));
      if (t) setTemplates(JSON.parse(t));
    } catch {
      // ignore parse errors — just use defaults
    }
  }, []);

  function handleSave() {
    localStorage.setItem("rk_notif_email",     JSON.stringify(email));
    localStorage.setItem("rk_notif_whatsapp",  JSON.stringify(whatsapp));
    localStorage.setItem("rk_notif_reminders", JSON.stringify(reminders));
    localStorage.setItem("rk_notif_templates", JSON.stringify(templates));
    setSaved(true);
    toast.success("Settings saved successfully");
    setTimeout(() => setSaved(false), 3000);
  }

  function handleReset() {
    setEmail(DEFAULT_EMAIL);
    setWhatsapp(DEFAULT_WHATSAPP);
    setReminders(DEFAULT_REMINDERS);
    setTemplates(DEFAULT_TEMPLATES);
    toast.info("Reset to default settings");
  }

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === id
                ? "bg-brand-red text-white"
                : "bg-white border border-border text-brand-gray-mid hover:text-brand-black"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Email / SMTP ──────────────────────────────────────────────────── */}
      {activeTab === "email" && (
        <div className="bg-white rounded-xl border border-border p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2">
              <Mail className="w-4 h-4 text-brand-red" /> Email / SMTP Configuration
            </h2>
            <div className="flex items-center gap-2">
              <Switch
                checked={email.enabled}
                onCheckedChange={(v) => setEmail((s) => ({ ...s, enabled: v }))}
              />
              <span className="text-xs font-medium">{email.enabled ? "Enabled" : "Disabled"}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Sender Name</Label>
              <Input
                value={email.sender_name}
                onChange={(e) => setEmail((s) => ({ ...s, sender_name: e.target.value }))}
                placeholder="Robotek FinOS"
              />
            </div>
            <div className="space-y-1.5">
              <Label>From Email</Label>
              <Input
                type="email"
                value={email.from_email}
                onChange={(e) => setEmail((s) => ({ ...s, from_email: e.target.value }))}
                placeholder="noreply@robotek.in"
              />
            </div>
            <div className="space-y-1.5">
              <Label>SMTP Host</Label>
              <Input
                value={email.smtp_host}
                onChange={(e) => setEmail((s) => ({ ...s, smtp_host: e.target.value }))}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>SMTP Port</Label>
              <Input
                value={email.smtp_port}
                onChange={(e) => setEmail((s) => ({ ...s, smtp_port: e.target.value }))}
                placeholder="587"
              />
            </div>
            <div className="space-y-1.5">
              <Label>SMTP Username</Label>
              <Input
                value={email.smtp_user}
                onChange={(e) => setEmail((s) => ({ ...s, smtp_user: e.target.value }))}
                placeholder="your@gmail.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>SMTP Password</Label>
              <div className="relative">
                <Input
                  type={showSmtpPwd ? "text" : "password"}
                  value={email.smtp_password}
                  onChange={(e) => setEmail((s) => ({ ...s, smtp_password: e.target.value }))}
                  placeholder="App password or SMTP password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray-mid hover:text-brand-black"
                >
                  {showSmtpPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={email.use_tls}
              onCheckedChange={(v) => setEmail((s) => ({ ...s, use_tls: v }))}
            />
            <label className="text-sm">Use TLS/STARTTLS encryption</label>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
            <strong>Tip for Gmail:</strong> Enable 2-factor auth and generate an App Password at
            myaccount.google.com → Security → App Passwords. Use it as the SMTP password.
          </div>
        </div>
      )}

      {/* ── WhatsApp ──────────────────────────────────────────────────────── */}
      {activeTab === "whatsapp" && (
        <div className="bg-white rounded-xl border border-border p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-green-600" /> WhatsApp API Configuration
            </h2>
            <div className="flex items-center gap-2">
              <Switch
                checked={whatsapp.enabled}
                onCheckedChange={(v) => setWhatsapp((s) => ({ ...s, enabled: v }))}
              />
              <span className="text-xs font-medium">{whatsapp.enabled ? "Enabled" : "Disabled"}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>WhatsApp Provider</Label>
            <Select
              value={whatsapp.provider}
              onValueChange={(v) => setWhatsapp((s) => ({ ...s, provider: v ?? s.provider }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="twilio">Twilio (WhatsApp Business API)</SelectItem>
                <SelectItem value="meta">Meta (WhatsApp Cloud API)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {whatsapp.provider === "twilio" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Account SID</Label>
                <Input
                  value={whatsapp.account_sid}
                  onChange={(e) => setWhatsapp((s) => ({ ...s, account_sid: e.target.value }))}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Auth Token</Label>
                <div className="relative">
                  <Input
                    type={showWaToken ? "text" : "password"}
                    value={whatsapp.auth_token}
                    onChange={(e) => setWhatsapp((s) => ({ ...s, auth_token: e.target.value }))}
                    placeholder="Your Twilio auth token"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWaToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray-mid hover:text-brand-black"
                  >
                    {showWaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>From Number (Twilio WhatsApp Sandbox)</Label>
                <Input
                  value={whatsapp.from_number}
                  onChange={(e) => setWhatsapp((s) => ({ ...s, from_number: e.target.value }))}
                  placeholder="whatsapp:+14155238886"
                />
                <p className="text-xs text-muted-foreground">Format: whatsapp:+[country code][number]</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Meta Access Token</Label>
                <div className="relative">
                  <Input
                    type={showWaToken ? "text" : "password"}
                    value={whatsapp.meta_token}
                    onChange={(e) => setWhatsapp((s) => ({ ...s, meta_token: e.target.value }))}
                    placeholder="EAAxxxxxxxxxx..."
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWaToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray-mid hover:text-brand-black"
                  >
                    {showWaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number ID</Label>
                <Input
                  value={whatsapp.meta_phone_id}
                  onChange={(e) => setWhatsapp((s) => ({ ...s, meta_phone_id: e.target.value }))}
                  placeholder="123456789012345"
                />
                <p className="text-xs text-muted-foreground">From Meta Business Manager → WhatsApp</p>
              </div>
            </div>
          )}

          <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-xs text-green-700 space-y-1">
            <p className="font-semibold">WhatsApp Opt-in Required</p>
            <p>Users must opt in to receive WhatsApp reminders. Enable WhatsApp notifications per user in the Users table (notify_whatsapp column).</p>
          </div>
        </div>
      )}

      {/* ── Reminder Rules ────────────────────────────────────────────────── */}
      {activeTab === "reminders" && (
        <div className="space-y-4">
          {/* Compliance reminders */}
          <div className="bg-white rounded-xl border border-border p-5 space-y-4">
            <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-red" /> Compliance Reminders
            </h2>
            <DayChips
              label="Send reminders on these days before due date"
              value={reminders.compliance_days_before}
              onChange={(v) => setReminders((s) => ({ ...s, compliance_days_before: v }))}
              options={[30, 14, 7, 3, 1, 0]}
            />
            <p className="text-xs text-muted-foreground">
              Applies to GST, TDS, TCS, Advance Tax, PF/ESI, and ROC filings.
            </p>
          </div>

          {/* Task reminders */}
          <div className="bg-white rounded-xl border border-border p-5 space-y-4">
            <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" /> Task Due Reminders
            </h2>
            <DayChips
              label="Send reminders on these days before task due date"
              value={reminders.task_days_before}
              onChange={(v) => setReminders((s) => ({ ...s, task_days_before: v }))}
              options={[14, 7, 3, 1, 0]}
            />
          </div>

          {/* AR auto-reminder */}
          <div className="bg-white rounded-xl border border-border p-5 space-y-4">
            <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2">
              <Bell className="w-4 h-4 text-green-600" /> AR Auto-Reminder (Customer Collection)
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Days before due date</Label>
                <Select
                  value={String(reminders.ar_days_before_due)}
                  onValueChange={(v) => setReminders((s) => ({ ...s, ar_days_before_due: Number(v) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 7, 10, 14].map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} day{d > 1 ? "s" : ""} before</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Days after due date (overdue)</Label>
                <Select
                  value={String(reminders.ar_days_after_due)}
                  onValueChange={(v) => setReminders((s) => ({ ...s, ar_days_after_due: Number(v) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 7, 10, 15, 30].map((d) => (
                      <SelectItem key={d} value={String(d)}>Every {d} day{d > 1 ? "s" : ""} after</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Escalation */}
          <div className="bg-white rounded-xl border border-border p-5 space-y-4">
            <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" /> Escalation Rules
            </h2>
            <div className="space-y-1.5">
              <Label>Escalate to next role if not actioned within</Label>
              <Select
                value={String(reminders.escalation_hours)}
                onValueChange={(v) => setReminders((s) => ({ ...s, escalation_hours: Number(v) }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 8, 12, 24, 48, 72].map((h) => (
                    <SelectItem key={h} value={String(h)}>{h} hour{h > 1 ? "s" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              If a task or compliance item is not acted upon within this window after a reminder, the
              next role up (e.g., Accounts → CFO → CEO) will be notified automatically.
            </p>
          </div>
        </div>
      )}

      {/* ── Message Templates ─────────────────────────────────────────────── */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          {(["ar_reminder", "compliance_reminder", "task_reminder"] as const).map((key) => {
            const LABEL = {
              ar_reminder:          "AR Payment Reminder (sent to customers)",
              compliance_reminder:  "Compliance Due Reminder (sent to team)",
              task_reminder:        "Task Due Reminder (sent to assignee)",
            }[key];

            return (
              <div key={key} className="bg-white rounded-xl border border-border p-5 space-y-3">
                <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-red" />
                  {LABEL}
                </h2>

                {/* Variable chips */}
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARS[key].map((v) => (
                    <span
                      key={v}
                      className="text-[10px] font-mono bg-brand-gray-light border border-border rounded px-1.5 py-0.5 text-brand-gray-mid"
                    >
                      {v}
                    </span>
                  ))}
                </div>

                <Textarea
                  value={templates[key]}
                  onChange={(e) => setTemplates((s) => ({ ...s, [key]: e.target.value }))}
                  rows={7}
                  className="font-mono text-xs resize-y"
                />

                {/* Live preview */}
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
                      .replace("{task_title}",    "Verify vendor invoices for April")
                      .replace("{priority}",      "High")}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}

      <Separator />

      {/* Save / Reset */}
      <div className="flex items-center gap-3 pb-6">
        <Button
          type="button"
          onClick={handleSave}
          className="!bg-brand-red hover:!bg-brand-maroon !text-white"
        >
          {saved
            ? <><CheckCircle2 className="w-4 h-4 mr-1.5" />Saved</>
            : "Save Settings"
          }
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
        >
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
