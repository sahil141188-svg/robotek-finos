"use client";

/**
 * AddUserSheet — client wrapper so the Sheet can close itself after
 * successful user creation (Bug #7 fix).
 *
 * The admin page is a Server Component, which cannot manage `open` state.
 * This thin client component owns the open/close state and passes
 * onSuccess={() => setOpen(false)} into UserForm.
 */

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { UserForm } from "@/components/admin/user-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function AddUserSheet() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Base UI Dialog.Trigger uses render prop (not asChild) for slot composition */}
      <SheetTrigger
        render={
          <button className="inline-flex items-center gap-2 h-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] font-medium bg-brand-red hover:bg-brand-maroon text-white transition-colors">
            <UserPlus className="w-3.5 h-3.5" />
            Add User
          </button>
        }
      />
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Add New User</SheetTitle>
          <SheetDescription>
            Set the user&apos;s email, password, role, company access, and module permissions.
            No invitation email — the user logs in directly with these credentials.
          </SheetDescription>
        </SheetHeader>
        {/* Bug #7 fix: onSuccess closes the sheet */}
        <UserForm onSuccess={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
