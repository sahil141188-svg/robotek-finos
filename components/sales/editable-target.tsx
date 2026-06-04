"use client";

/**
 * Inline editable monthly target for any item. Click the number to edit,
 * Enter/blur to save. Works for both company items and customer items.
 * Calls a server action (passed as prop) so the same component handles both.
 */
import { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";

export function EditableTarget({
  value,
  onSave,
  suffix = "/mo",
}: {
  value: number;
  onSave: (newQty: number) => Promise<{ ok: boolean; error?: string }>;
  suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(String(value));
  const [current, setCurrent] = useState(value);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  function open() { setInput(String(current)); setErr(""); setEditing(true); }
  function cancel() { setEditing(false); setErr(""); }

  function save() {
    const n = Math.round(Number(input.replace(/[^0-9]/g, "")));
    if (isNaN(n) || n < 0) { setErr("Enter a valid number"); return; }
    start(async () => {
      const res = await onSave(n);
      if (res.ok) { setCurrent(n); setEditing(false); setErr(""); }
      else setErr(res.error ?? "Save failed");
    });
  }

  if (!editing) {
    return (
      <span className="group inline-flex items-center gap-1.5">
        <span className="font-semibold text-brand-black">
          {current.toLocaleString("en-IN")}{suffix}
        </span>
        <button
          onClick={open}
          className="opacity-0 group-hover:opacity-100 text-brand-gray-mid hover:text-brand-red transition-opacity"
          aria-label="Edit target"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="w-28 h-7 rounded-lg border border-brand-red/40 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
          placeholder="qty/mo"
        />
        <button onClick={save} disabled={pending} className="h-7 w-7 rounded-lg bg-brand-red text-white hover:bg-brand-maroon disabled:opacity-50 flex items-center justify-center" aria-label="Save"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={cancel} className="h-7 w-7 rounded-lg border border-border text-brand-gray-mid hover:text-brand-red flex items-center justify-center" aria-label="Cancel"><X className="w-3.5 h-3.5" /></button>
      </span>
      {err && <span className="text-[10px] text-red-600">{err}</span>}
      {pending && <span className="text-[10px] text-brand-gray-mid">Saving…</span>}
    </span>
  );
}
