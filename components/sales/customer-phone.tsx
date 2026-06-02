"use client";

/**
 * Inline WhatsApp-number editor for a sales customer. Shows the saved number
 * with an edit affordance, or an "add number" input. Progressively builds the
 * phone database so automated sends become possible later.
 */
import { useState, useTransition } from "react";
import { Phone, Check, Pencil } from "lucide-react";
import { setSalesCustomerPhone } from "@/app/actions/sales";

export function CustomerPhone({ id, phone }: { id: string; phone: string | null }) {
  const [editing, setEditing] = useState(!phone);
  const [value, setValue] = useState(phone ?? "");
  const [saved, setSaved] = useState(phone);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await setSalesCustomerPhone(id, value);
      if (res.ok) {
        setSaved(res.phone);
        setEditing(false);
      }
    });
  }

  if (!editing) {
    return (
      <div className="inline-flex items-center gap-2 text-sm">
        <Phone className="w-3.5 h-3.5 text-brand-gray-mid" />
        <span className="font-medium text-brand-black">{saved}</span>
        <button onClick={() => setEditing(true)} className="text-brand-gray-mid hover:text-brand-red" aria-label="Edit number">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="WhatsApp number"
        inputMode="tel"
        className="h-8 w-44 rounded-lg border border-border px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
      />
      <button
        onClick={save}
        disabled={pending}
        className="inline-flex items-center gap-1 h-8 rounded-lg px-2.5 text-xs font-medium bg-brand-red text-white hover:bg-brand-maroon disabled:opacity-50 transition-colors"
      >
        <Check className="w-3.5 h-3.5" /> {pending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
