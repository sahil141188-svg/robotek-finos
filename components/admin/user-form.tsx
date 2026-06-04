"use client";

import { useState, useTransition } from "react";
import { createUserWithPassword, updateUser } from "@/app/actions/users";
import { DEFAULT_PERMISSIONS, PERMISSION_GROUPS, PERMISSION_META } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";
import { COMPANIES } from "@/lib/companies-data";
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
import { ShieldCheck, Eye, EyeOff, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

// Bug #6 fix: COO role added to the role selector
const ROLES: UserRole[] = ["ceo", "cfo", "coo", "accounts", "ca"];

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
  const [fullName,    setFullName]    = useState(user?.full_name ?? "");
  const [email,       setEmail]       = useState(user?.email ?? "");
  const [password,    setPassword]    = useState("");
  const [confirmPwd,  setConfirmPwd]  = useState("");
  const [showPwd,     setShowPwd]     = useState(false);
  const [role,        setRole]        = useState<UserRole>(user?.role ?? "accounts");
  const [isActive,    setIsActive]    = useState(user?.is_active ?? true);
  const [permissions, setPermissions] = useState<UserPermissions>(
    user?.permissions ?? DEFAULT_PERMISSIONS["accounts"]
  );
  // Company access — array of company ids this user can access
  const [companyIds, setCompanyIds] = useState<string[]>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (user as any)?.company_ids ?? COMPANIES.map((c) => c.id)
  );
  // Sales team (NBD/CRR) assignment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [crmDept,     setCrmDept]     = useState<string>((user as any)?.crm_department ?? "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [crmTeamRole, setCrmTeamRole] = useState<string>((user as any)?.crm_team_role ?? "");

  /** Apply a Sales OS role preset: sets department + team role + Sales-OS-only access. */
  function applyPreset(dept: string, teamRole: string) {
    setRole("accounts");          // base finance role (lowest); access comes from permissions
    setCrmDept(dept);
    setCrmTeamRole(teamRole);
    const salesOnly = Object.fromEntries(
      Object.keys(permissions).map((k) => [k, false])
    ) as UserPermissions;
    salesOnly.view_crm = true;
    salesOnly.manage_crm = true;
    setPermissions(salesOnly);
  }

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

  /** Toggle a company in the company access list */
  function toggleCompany(id: string) {
    setCompanyIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAllCompanies() {
    setCompanyIds(COMPANIES.map((c) => c.id));
  }

  function clearAllCompanies() {
    setCompanyIds([]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!isEditing && password !== confirmPwd) {
      setError("Passwords do not match.");
      return;
    }
    if (!isEditing && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    startTransition(async () => {
      try {
        if (isEditing && user) {
          await updateUser(user.id, {
            full_name: fullName,
            // Bug fix: include email so the upsert can INSERT if the profile
            // row is missing (synthetic auth-only user → avoids NOT NULL error)
            email: user.email,
            role,
            is_active: isActive,
            permissions,
            crm_department: crmDept || null,
            crm_team_role: crmTeamRole || null,
          });
        } else {
          const fd = new FormData();
          fd.set("email",       email);
          fd.set("full_name",   fullName);
          fd.set("password",    password);
          fd.set("role",        role);
          fd.set("permissions", JSON.stringify(permissions));
          fd.set("crm_department", crmDept);
          fd.set("crm_team_role",  crmTeamRole);
          await createUserWithPassword(fd);
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
      {/* ── Basic info ── */}
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
          <>
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
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Set Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray-mid hover:text-brand-black"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPwd">Confirm Password</Label>
              <Input
                id="confirmPwd"
                type={showPwd ? "text" : "password"}
                value={confirmPwd}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPwd(e.target.value)}
                placeholder="Repeat password"
                required
                className={cn(
                  confirmPwd && confirmPwd !== password ? "border-red-400 focus-visible:ring-red-400" : ""
                )}
              />
              {confirmPwd && confirmPwd !== password && (
                <p className="text-xs text-red-600">Passwords do not match</p>
              )}
            </div>

            <p className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2">
              The user will log in directly with these credentials. No email invitation will be sent.
            </p>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="role">
              {crmTeamRole ? "System Role" : "Role"}
            </Label>
            {crmTeamRole ? (
              // Sales team member — show their actual job title, not the hidden "accounts" base
              <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-brand-red/30 bg-brand-red/5">
                <span className="text-sm font-medium text-brand-red capitalize">
                  {crmDept?.toUpperCase()} — {crmTeamRole.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
            ) : (
              <Select value={role} onValueChange={(v) => handleRoleChange(v as UserRole)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                {/* Bug #16 fix: z-50 keeps dropdown below the sheet close button */}
                <SelectContent className="z-50">
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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

      {/* ── Sales team (NBD / CRR) ── */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Sales Team (NBD / CRR) Role</h3>
        <p className="text-xs text-muted-foreground">
          For sales staff — click a preset below. It sets their role, department, and Sales OS access automatically.
          {crmTeamRole && <span className="text-brand-red font-medium"> ✓ Preset active — the Role field above shows their job title.</span>}
          {!crmTeamRole && " Leave blank for finance-only users (CEO, CFO, Accounts etc)."}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "NBD — Sales Coordinator", dept: "nbd", role: "sales_coordinator" },
            { label: "NBD — Sales Expert",      dept: "nbd", role: "sales_expert" },
            { label: "NBD — Field Sales Rep",   dept: "nbd", role: "fsr" },
            { label: "NBD — Lead Generation",   dept: "nbd", role: "lead_gen" },
            { label: "CRR — Sales Coordinator", dept: "crr", role: "sales_coordinator" },
            { label: "CRR — CRM (Acct Manager)",dept: "crr", role: "crm" },
            { label: "CRR — Sales Expert",      dept: "crr", role: "sales_expert" },
            { label: "Sales Head (NBD + CRR)",  dept: "nbd", role: "sales_head" },
          ].map((p) => {
            const active = crmDept === p.dept && crmTeamRole === p.role;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.dept, p.role)}
                className={cn(
                  "text-xs rounded-lg border px-3 py-2 text-left transition-colors",
                  active ? "border-brand-red bg-brand-red/5 text-brand-red font-medium" : "border-border hover:border-brand-red/50"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Department</Label>
            <select value={crmDept} onChange={(e) => setCrmDept(e.target.value)} className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm">
              <option value="">— none —</option>
              <option value="nbd">NBD (New Business)</option>
              <option value="crr">CRR (Retention)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Sales role</Label>
            <select value={crmTeamRole} onChange={(e) => setCrmTeamRole(e.target.value)} className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm">
              <option value="">— none —</option>
              <option value="lead_gen">Lead Generation</option>
              <option value="sales_coordinator">Sales Coordinator (SC)</option>
              <option value="sales_expert">Sales Expert</option>
              <option value="crm">CRM (Account Manager)</option>
              <option value="fsr">Field Sales Rep (FSR)</option>
              <option value="sales_head">Sales Head</option>
            </select>
          </div>
        </div>
        {crmTeamRole && (
          <button
            type=”button”
            onClick={() => { setCrmDept(“”); setCrmTeamRole(“”); if(!isEditing) setPermissions(DEFAULT_PERMISSIONS[role]); }}
            className=”text-xs text-muted-foreground hover:text-brand-red underline”
          >
            ✕ Clear sales role — switch to finance role instead
          </button>
        )}
      </div>

      <Separator />

      {/* ── Company Access ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-red" />
            <h3 className="font-semibold text-sm">Company Access</h3>
          </div>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={selectAllCompanies}
              disabled={companyIds.length === COMPANIES.length}
              className="text-brand-red hover:underline disabled:opacity-30"
            >
              All
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              onClick={clearAllCompanies}
              disabled={companyIds.length === 0}
              className="text-muted-foreground hover:text-foreground hover:underline disabled:opacity-30"
            >
              None
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden max-h-52 overflow-y-auto">
          {COMPANIES.map((co) => (
            <label
              key={co.id}
              htmlFor={`co-${co.id}`}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors border-b border-border last:border-0"
            >
              <input
                id={`co-${co.id}`}
                type="checkbox"
                checked={companyIds.includes(co.id)}
                onChange={() => toggleCompany(co.id)}
                className="h-4 w-4 rounded border-border accent-brand-red cursor-pointer"
              />
              <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", co.color_class)}>
                <Building2 className="w-2.5 h-2.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight truncate">{co.short_name}</p>
                <p className="text-xs text-muted-foreground truncate">{co.city}</p>
              </div>
              {co.status === "dormant" && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Dormant</span>
              )}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {companyIds.length} of {COMPANIES.length} companies selected
        </p>
      </div>

      <Separator />

      {/* ── Permissions ── */}
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
          const allOn  = groupPerms.every((p) => permissions[p.key]);
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
            ? isEditing ? "Saving…" : "Creating user…"
            : isEditing ? "Save changes" : "Create User"}
        </Button>
      </div>
    </form>
  );
}
