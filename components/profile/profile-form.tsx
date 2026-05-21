"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/app/actions/users";
import { ROLE_LABELS } from "@/lib/roles";
import type { Database } from "@/types/database";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { User, MessageSquare, Mail, Bell, Shield } from "lucide-react";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

export function ProfileForm({ profile }: { profile: UserRow }) {
  const [isPending, startTransition] = useTransition();

  const [fullName,       setFullName]       = useState(profile.full_name);
  const [whatsappNumber, setWhatsappNumber] = useState(profile.whatsapp_number ?? "");
  const [notifyEmail,    setNotifyEmail]    = useState(profile.notify_email ?? true);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(profile.notify_whatsapp ?? false);
  const [error,          setError]          = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await updateProfile({
          full_name:       fullName,
          whatsapp_number: whatsappNumber.trim() || null,
          notify_email:    notifyEmail,
          notify_whatsapp: notifyWhatsapp,
        });
        toast.success("Profile updated successfully");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Update failed";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  const initials = fullName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar + role badge */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-brand-red flex items-center justify-center shrink-0">
          <span className="text-white text-xl font-bold">{initials}</span>
        </div>
        <div>
          <p className="text-lg font-bold text-brand-black">{profile.full_name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-brand-red/10 text-brand-red px-2.5 py-0.5 rounded-full border border-brand-red/20">
              <Shield className="w-3 h-3" />
              {ROLE_LABELS[profile.role] ?? profile.role}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${profile.is_active ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-600"}`}>
              {profile.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Basic info */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User className="w-4 h-4 text-brand-red" />
          <h3 className="font-semibold text-sm">Basic Information</h3>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full Name</Label>
          <Input
            id="full_name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label>Email Address</Label>
          <Input
            value={profile.email}
            disabled
            className="bg-brand-gray-light/50 text-brand-gray-mid"
          />
          <p className="text-xs text-muted-foreground">Email cannot be changed. Contact your admin.</p>
        </div>
      </div>

      <Separator />

      {/* Notification channels */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-brand-red" />
          <h3 className="font-semibold text-sm">Notification Preferences</h3>
        </div>

        {/* Email notifications */}
        <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Mail className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Email Notifications</p>
              <p className="text-xs text-brand-gray-mid">Compliance reminders, task alerts</p>
            </div>
          </div>
          <Switch
            checked={notifyEmail}
            onCheckedChange={setNotifyEmail}
          />
        </div>

        {/* WhatsApp notifications */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-white">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium">WhatsApp Notifications</p>
                <p className="text-xs text-brand-gray-mid">Instant alerts on your phone</p>
              </div>
            </div>
            <Switch
              checked={notifyWhatsapp}
              onCheckedChange={setNotifyWhatsapp}
            />
          </div>

          {notifyWhatsapp && (
            <div className="space-y-1.5 px-1">
              <Label htmlFor="whatsapp">WhatsApp Number</Label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 rounded-lg border border-border bg-brand-gray-light text-sm text-brand-gray-mid">
                  +91
                </span>
                <Input
                  id="whatsapp"
                  type="tel"
                  value={whatsappNumber.replace(/^\+91/, "")}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setWhatsappNumber(raw ? `+91${raw}` : "");
                  }}
                  placeholder="98765 43210"
                  maxLength={10}
                  pattern="[0-9]{10}"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                10-digit mobile number. You will receive compliance and task reminders via WhatsApp.
              </p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          className="!bg-brand-red hover:!bg-brand-maroon !text-white"
          disabled={isPending}
        >
          {isPending ? "Saving…" : "Save Profile"}
        </Button>
      </div>
    </form>
  );
}
