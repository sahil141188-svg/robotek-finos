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
          <button className="inline-flex items-center gap-2 h-9 sm:h-8 rounded-xl px-4 sm:px-3 text-sm sm:text-[0.8rem] font-semibold bg-brand-red hover:bg-brand-maroon text-white transition-colors shadow-sm">
            <UserPlus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            Add User
          </button>
        }
      />
      {/* w-full on mobile, 520px on sm+ — full-screen sheet on phone */}
      <SheetContent className="w-full sm:w-[520px] sm:max-w-[520px] overflow-y-auto p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border sticky top-0 bg-white z-10">
          <SheetTitle className="text-lg">Add New User</SheetTitle>
          <SheetDescription className="text-sm">
            Set the user&apos;s email, password, role, company access, and module permissions.
            No invitation email — the user logs in directly with these credentials.
          </SheetDescription>
        </SheetHeader>
        <div className="px-5 py-5">
          <UserForm onSuccess={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
