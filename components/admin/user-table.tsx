"use client";

/**
 * UserTable — Admin Panel
 *
 * Desktop: full table with all columns.
 * Mobile: card-per-user layout (no horizontal scroll needed).
 *
 * Features:
 *   - Edit user in a full-screen sheet on mobile
 *   - Delete user with inline confirmation (CEO only)
 *   - Toggle active / inactive with Switch
 */

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";
import { toggleUserActive, deleteUser } from "@/app/actions/users";
import { ROLE_LABELS } from "@/lib/roles";
import { PERMISSION_META } from "@/lib/permissions";
import { UserForm } from "./user-form";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, ShieldCheck, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

interface UserTableProps {
  users: UserRow[];
}

export function UserTable({ users: initialUsers }: UserTableProps) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  // Sync when server re-fetches (router.refresh() updates props but useState ignores it)
  useEffect(() => { setUsers(initialUsers); }, [initialUsers]);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggleActive(userId: string, current: boolean) {
    startTransition(async () => {
      try {
        await toggleUserActive(userId, !current);
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: !current } : u));
        toast.success(`User ${!current ? "activated" : "deactivated"}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update status");
      }
    });
  }

  function handleDeleteClick(userId: string) {
    setConfirmDeleteId(userId);
  }

  function handleDeleteConfirm() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    startTransition(async () => {
      const result = await deleteUser(id);
      if (result.success) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        toast.success("User deleted");
      } else {
        toast.error(result.error ?? "Failed to delete user");
      }
    });
  }

  function openEdit(user: UserRow) {
    setEditingUser(user);
    setSheetOpen(true);
  }

  function permCount(user: UserRow): number {
    return PERMISSION_META.filter((p) => user.permissions?.[p.key]).length;
  }

  const roleColors: Record<string, string> = {
    ceo:      "bg-brand-red/10 text-brand-red border-brand-red/20",
    accounts: "bg-purple-50 text-purple-700 border-purple-200",
    sales:    "bg-green-50 text-green-700 border-green-200",
  };

  /** Display label for a user: sales team role takes priority over base system role */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function roleLabel(user: any): string {
    if (user.crm_team_role && user.crm_department) {
      const dept = String(user.crm_department).toUpperCase();
      const role = String(user.crm_team_role).replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
      return `${dept} — ${role}`;
    }
    return ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function roleBadgeClass(user: any): string {
    if (user.crm_team_role) return roleColors.sales;
    return roleColors[user.role as keyof typeof roleColors] ?? "bg-gray-50 text-gray-700 border-gray-200";
  }

  return (
    <>
      {/* ── Mobile: card list ─────────────────────────────────── */}
      <div className="sm:hidden space-y-3">
        {users.length === 0 && (
          <div className="text-center py-10 text-base text-muted-foreground bg-white rounded-xl border border-border">
            No users yet. Tap <strong>+ Add User</strong> to get started.
          </div>
        )}
        {users.map((user) => (
          <div
            key={user.id}
            className="bg-white rounded-xl border border-border p-4 space-y-3"
          >
            {/* Top row: avatar + name + role */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-red flex items-center justify-center shrink-0">
                <span className="text-white text-base font-bold uppercase">
                  {user.full_name.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-brand-black truncate">{user.full_name}</p>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              </div>
              <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                roleBadgeClass(user)
              }`}>
                {roleLabel(user)}
              </span>
            </div>

            {/* Middle row: permissions + status */}
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <ShieldCheck className="w-4 h-4" />
                <span>{permCount(user)} / {PERMISSION_META.length} permissions</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={user.is_active}
                  onCheckedChange={() => handleToggleActive(user.id, user.is_active)}
                  disabled={isPending}
                />
                <span className={`text-sm font-medium ${user.is_active ? "text-green-700" : "text-muted-foreground"}`}>
                  {user.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            {/* Delete confirmation */}
            {confirmDeleteId === user.id && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-800">Delete {user.full_name}?</p>
                  <p className="text-xs text-red-600 mt-0.5">This cannot be undone. The user will lose access immediately.</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleDeleteConfirm}
                      disabled={isPending}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-brand-black"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom row: actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => openEdit(user)}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-lg border border-border hover:border-brand-red/30 hover:text-brand-red transition-colors"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
              <button
                onClick={() => handleDeleteClick(user.id)}
                disabled={isPending || confirmDeleteId === user.id}
                className="flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop: table ────────────────────────────────────── */}
      <div className="hidden sm:block rounded-xl border border-border overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Email</TableHead>
              <TableHead className="font-semibold">Role</TableHead>
              <TableHead className="font-semibold">Permissions</TableHead>
              <TableHead className="font-semibold text-center">Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No users yet. Click <strong>+ Add User</strong> to get started.
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => (
              <TableRow key={user.id} className="hover:bg-muted/20">
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-brand-red flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-bold uppercase">{user.full_name.charAt(0)}</span>
                    </div>
                    <span className="font-medium text-sm">{user.full_name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
                    roleColors[user.role] ?? "bg-gray-50 text-gray-700 border-gray-200"
                  }`}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {permCount(user)} <span className="text-xs">/ {PERMISSION_META.length}</span>
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Switch
                      checked={user.is_active}
                      onCheckedChange={() => handleToggleActive(user.id, user.is_active)}
                      disabled={isPending}
                    />
                    <span className={`text-xs font-medium ${user.is_active ? "text-green-700" : "text-muted-foreground"}`}>
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {confirmDeleteId === user.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleDeleteConfirm}
                        disabled={isPending}
                        className="text-xs font-semibold px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs px-2 py-1 rounded border text-muted-foreground hover:text-brand-black"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(user)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-red transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(user.id)}
                        disabled={isPending}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ── Edit user sheet (full-screen on mobile) ────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        {/* w-full on mobile, fixed 520px on sm+ */}
        <SheetContent className="w-full sm:w-[520px] sm:max-w-[520px] overflow-y-auto p-0">
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border sticky top-0 bg-white z-10">
            <SheetTitle className="text-lg">Edit User</SheetTitle>
            <SheetDescription className="text-sm">
              Update {editingUser?.full_name}&apos;s role, status, and module permissions.
            </SheetDescription>
          </SheetHeader>
          <div className="px-5 py-5">
            {editingUser && (
              <UserForm
                user={editingUser}
                onSuccess={() => {
                  setSheetOpen(false);
                  toast.success("User updated successfully");
                  // Refresh server-component data so the list shows the new values
                  router.refresh();
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
