"use client";

import { useState, useTransition } from "react";
import type { Database } from "@/types/database";
import { toggleUserActive } from "@/app/actions/users";
import { ROLE_LABELS } from "@/lib/roles";
import { PERMISSION_META } from "@/lib/permissions";
import { UserForm } from "./user-form";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

interface UserTableProps {
  users: UserRow[];
}

export function UserTable({ users }: UserTableProps) {
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleToggleActive(userId: string, current: boolean) {
    startTransition(async () => {
      try {
        await toggleUserActive(userId, !current);
        toast.success(`User ${!current ? "activated" : "deactivated"}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update status");
      }
    });
  }

  function openEdit(user: UserRow) {
    setEditingUser(user);
    setSheetOpen(true);
  }

  /** Count how many permissions are enabled for a user */
  function permCount(user: UserRow): number {
    return PERMISSION_META.filter((p) => user.permissions?.[p.key]).length;
  }

  const roleColors: Record<string, string> = {
    ceo: "bg-brand-red/10 text-brand-red border-brand-red/20",
    cfo: "bg-blue-50 text-blue-700 border-blue-200",
    accounts: "bg-purple-50 text-purple-700 border-purple-200",
    ca: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <>
      <div className="rounded-xl border border-border overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Email</TableHead>
              <TableHead className="font-semibold">Role</TableHead>
              <TableHead className="font-semibold">Permissions</TableHead>
              <TableHead className="font-semibold text-center">Status</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No users yet. Click <strong>+ Invite User</strong> to get started.
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => (
              <TableRow key={user.id} className="hover:bg-muted/20">
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-brand-red flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-bold uppercase">
                        {user.full_name.charAt(0)}
                      </span>
                    </div>
                    <span className="font-medium text-sm">{user.full_name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
                      roleColors[user.role] ?? "bg-gray-50 text-gray-700 border-gray-200"
                    }`}
                  >
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {permCount(user)}{" "}
                      <span className="text-xs">/ {PERMISSION_META.length}</span>
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
                    <span
                      className={`text-xs font-medium ${
                        user.is_active ? "text-green-700" : "text-muted-foreground"
                      }`}
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => openEdit(user)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand-red transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit user sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Edit User</SheetTitle>
            <SheetDescription>
              Update {editingUser?.full_name}&apos;s role, status, and module permissions.
            </SheetDescription>
          </SheetHeader>
          {editingUser && (
            <UserForm
              user={editingUser}
              onSuccess={() => {
                setSheetOpen(false);
                toast.success("User updated successfully");
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
