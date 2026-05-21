"use client";

import { useState, useTransition } from "react";
import { inviteUser, updateUser } from "@/app/actions/users";
import { DEFAULT_PERMISSIONS, PERMISSION_GROUPS, PERMISSION_META } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";
import type { Database, UserPermissions, UserRole } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

const ROLES: UserRole[] = ["ceo", "cfo", "accounts", "ca"];

interface UserFormProps {
  /** Pass an existing user to edit; omit to create a new one */
  user?: UserRow;
  onSuccess?: () => void;
}

export function UserForm({ user, onSuccess }: UserFormProps) {
  const isEditing = Boolean(user);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<UserRole>(user?.role ?? "accounts");
  const [isActive, setIsActive] = useState(user?.is_active ?? true);
  const [permissions, setPermissions] = useState<UserPermissions>(
    user?.permissions ?? DEFAULT_PERMISSIONS["accounts"]
  );

  /** When the role changes, reset permissions to the role's defaults */
  function handleRoleChange(newRole: UserRole) {
    setRole(newRole);
    // Only reset permissions when creating — preserve custom perms when editing
    if (!isEditing) {
      setPermissions(DEFAULT_PERMISSIONS[newRole]);
    }
  }

  /** Toggle a single permission checkbox */
  function togglePermission(key: keyof UserPermissions) {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  /** Select all or none in a group */
  function setGroupAll(group: string, value: boolean) {
    const keys = PERMISSION_META
      .filter((p) => p.group === group)
      .map((p) => p.key);
    setPermissions((prev) => {
      const next = { ...prev };
      keys.forEach((k) => { next[k] = value; });
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        if (isEditing && user) {
          await updateUser(user.id, {
            full_name: fullName,
            role,
            is_active: isActive,
            permissions,
          });
        } else {
          const fd = new FormData();
          fd.set("email", email);
          fd.set("full_name", fullName);
          fd.set("role", role);
          // permissions are set via the default for the role
          await inviteUser(fd);
        }
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  const enabledCount = Object.values(permissions).filter(Boolean).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic info */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full Name</Label>
          <Input
            id="full_name"
            value={fullName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
            placeholder="e.g. Rahul Sharma"
            required
          />
        </div>

        {!isEditing && (
          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder="rahul@robotek.in"
              required
            />
            <p className="text-xs text-muted-foreground">
              An invitation email will be sent to this address.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(v) => handleRoleChange(v as UserRole)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <div className="flex items-center gap-3 h-9 px-3 rounded-lg border border-border bg-background">
              <Switch
                id="is_active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <label htmlFor="is_active" className="text-sm cursor-pointer select-none">
                {isActive ? (
                  <span className="text-green-700 font-medium">Active</span>
                ) : (
                  <span className="text-muted-foreground">Inactive</span>
                )}
              </label>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Permissions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-red" />
            <h3 className="font-semibold text-sm">Module Permissions</h3>
          </div>
          <Badge variant="secondary" className="text-xs">
            {enabledCount} / {Object.keys(permissions).length} enabled
          </Badge>
        </div>

        {PERMISSION_GROUPS.map((group) => {
          const groupPerms = PERMISSION_META.filter((p) => p.group === group);
          const allOn = groupPerms.every((p) => permissions[p.key]);
          const allOff = groupPerms.every((p) => !permissions[p.key]);

          return (
            <div key={group} className="rounded-lg border border-border overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupAll(group, true)}
                    disabled={allOn}
                    className="text-xs text-brand-red hover:underline disabled:opacity-30 disabled:no-underline"
                  >
                    All
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    onClick={() => setGroupAll(group, false)}
                    disabled={allOff}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline disabled:opacity-30 disabled:no-underline"
                  >
                    None
                  </button>
                </div>
              </div>

              {/* Permission rows */}
              <div className="divide-y divide-border">
                {groupPerms.map((p) => (
                  <label
                    key={p.key}
                    htmlFor={`perm-${p.key}`}
                    className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <input
                      id={`perm-${p.key}`}
                      type="checkbox"
                      checked={permissions[p.key]}
                      onChange={() => togglePermission(p.key)}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-brand-red cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{p.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          className="flex-1 !bg-brand-red hover:!bg-brand-maroon !text-white"
          disabled={isPending}
        >
          {isPending
            ? isEditing ? "Saving…" : "Sending invite…"
            : isEditing ? "Save changes" : "Send invite"}
        </Button>
      </div>
    </form>
  );
}
