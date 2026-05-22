"use client";

/**
 * CompaniesSection — create, edit, and delete companies from the admin panel.
 * All changes call server actions + revalidate the dashboard layout so the
 * company switcher updates immediately without a full page reload.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCompany, updateCompany, deleteCompany } from "@/app/actions/companies";
import type { Company } from "@/lib/companies-data";

// ── Colour options ────────────────────────────────────────────────────────────

const COLOUR_OPTIONS = [
  { label: "Red",     value: "bg-brand-red",    preview: "#E52D31" },
  { label: "Blue",    value: "bg-blue-600",     preview: "#2563eb" },
  { label: "Yellow",  value: "bg-yellow-500",   preview: "#eab308" },
  { label: "Sky",     value: "bg-sky-600",      preview: "#0284c7" },
  { label: "Green",   value: "bg-emerald-600",  preview: "#059669" },
  { label: "Purple",  value: "bg-purple-600",   preview: "#9333ea" },
  { label: "Orange",  value: "bg-orange-600",   preview: "#ea580c" },
  { label: "Pink",    value: "bg-pink-600",     preview: "#db2777" },
  { label: "Teal",    value: "bg-teal-600",     preview: "#0d9488" },
  { label: "Indigo",  value: "bg-indigo-600",   preview: "#4f46e5" },
  { label: "Slate",   value: "bg-slate-500",    preview: "#64748b" },
  { label: "Maroon",  value: "bg-brand-maroon", preview: "#852321" },
];

// ── Company form (create & edit) ──────────────────────────────────────────────

function CompanyForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Company;
  onSave:   (fd: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [pending, start] = useTransition();
  const [colour, setColour] = useState(initial?.color_class ?? "bg-brand-red");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("color_class", colour);
    start(async () => { await onSave(fd); });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label htmlFor="name">Full Legal Name *</Label>
          <Input id="name" name="name" required defaultValue={initial?.name}
            placeholder="e.g. Robotek India Pvt Ltd" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="short_name">Short Name * <span className="text-xs text-muted-foreground">(max 18 chars, shown in sidebar)</span></Label>
          <Input id="short_name" name="short_name" required maxLength={18}
            defaultValue={initial?.short_name} placeholder="e.g. Robotek" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <select
            id="status" name="status"
            defaultValue={initial?.status ?? "active"}
            className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-brand-red/30"
          >
            <option value="active">Active</option>
            <option value="dormant">Dormant</option>
          </select>
        </div>
        <div>
          <Label htmlFor="type">Business Type</Label>
          <Input id="type" name="type" defaultValue={initial?.type}
            placeholder="e.g. Manufacturing" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="city">City / State</Label>
          <Input id="city" name="city" defaultValue={initial?.city}
            placeholder="e.g. Delhi" className="mt-1" />
        </div>
        <div className="col-span-2">
          <Label htmlFor="gstin">GSTIN</Label>
          <Input id="gstin" name="gstin" defaultValue={initial?.gstin}
            placeholder="e.g. 07AABCR1234A1Z5" className="mt-1 uppercase"
            style={{ textTransform: "uppercase" }} />
        </div>
      </div>

      {/* Colour picker */}
      <div>
        <Label>Avatar Colour</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {COLOUR_OPTIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => setColour(c.value)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                colour === c.value ? "border-brand-black scale-110" : "border-transparent"
              }`}
              style={{ background: c.preview }}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}
          className="bg-brand-red hover:bg-brand-maroon text-white">
          {pending ? "Saving…" : initial ? "Save Changes" : "Create Company"}
        </Button>
      </div>
    </form>
  );
}

// ── Delete confirmation ───────────────────────────────────────────────────────

function DeleteConfirm({ company, onConfirm, onCancel }: {
  company:   Company;
  onConfirm: () => Promise<void>;
  onCancel:  () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <p className="text-sm text-brand-black">
        Delete <strong>{company.name}</strong>? This cannot be undone.
        The company will be removed from the switcher immediately.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={pending}
          className="bg-red-600 hover:bg-red-700 text-white"
          onClick={() => start(async () => { await onConfirm(); })}
        >
          {pending ? "Deleting…" : "Yes, Delete"}
        </Button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type ModalState =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit";   company: Company }
  | { type: "delete"; company: Company };

export function CompaniesSection({ initialCompanies }: { initialCompanies: Company[] }) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [modal, setModal] = useState<ModalState>({ type: "none" });

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleCreate(fd: FormData) {
    const res = await createCompany(fd);
    if (!res.success) { toast.error(res.error ?? "Failed to create company"); return; }
    toast.success("Company created");
    // Reload page data so list refreshes from DB
    window.location.reload();
  }

  async function handleEdit(id: string, fd: FormData) {
    const res = await updateCompany(id, fd);
    if (!res.success) { toast.error(res.error ?? "Failed to update company"); return; }
    toast.success("Company updated");
    window.location.reload();
  }

  async function handleDelete(id: string) {
    const res = await deleteCompany(id);
    if (!res.success) { toast.error(res.error ?? "Failed to delete company"); return; }
    toast.success("Company deleted");
    setCompanies((prev) => prev.filter((c) => c.id !== id));
    setModal({ type: "none" });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-brand-red" />
          <h2 className="font-semibold text-brand-black">Companies</h2>
          <span className="text-xs text-muted-foreground">({companies.length})</span>
        </div>
        <Button
          size="sm"
          onClick={() => setModal({ type: "create" })}
          className="bg-brand-red hover:bg-brand-maroon text-white gap-1.5 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Company
        </Button>
      </div>

      {/* Create form (inline expand) */}
      {modal.type === "create" && (
        <div className="rounded-xl border border-brand-red/30 bg-red-50/40 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-4 h-4 text-brand-red" />
            <p className="text-sm font-semibold text-brand-black">New Company</p>
            <button onClick={() => setModal({ type: "none" })} className="ml-auto text-brand-gray-mid hover:text-brand-black">
              <X className="w-4 h-4" />
            </button>
          </div>
          <CompanyForm
            onSave={handleCreate}
            onCancel={() => setModal({ type: "none" })}
          />
        </div>
      )}

      {/* Company list */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        {companies.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No companies yet. Click &quot;Add Company&quot; to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-brand-gray-light/60">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-brand-gray-mid">Company</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-brand-gray-mid hidden sm:table-cell">Type / City</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-brand-gray-mid hidden md:table-cell">GSTIN</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-brand-gray-mid">Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-brand-gray-mid">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-brand-gray-light/30 transition-colors">
                  {/* Name + colour dot */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg ${c.color_class} flex items-center justify-center shrink-0`}>
                        <span className="text-white font-black text-xs">{c.short_name[0]}</span>
                      </div>
                      <div>
                        <p className="font-medium text-brand-black leading-tight">{c.name}</p>
                        <p className="text-xs text-brand-gray-mid">{c.short_name}</p>
                      </div>
                    </div>
                  </td>
                  {/* Type / city */}
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-xs text-brand-black">{c.type || "—"}</p>
                    <p className="text-xs text-brand-gray-mid">{c.city || "—"}</p>
                  </td>
                  {/* GSTIN */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs font-mono text-brand-gray-mid">
                      {c.gstin || "—"}
                    </span>
                  </td>
                  {/* Status badge */}
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      c.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {c.status === "active"
                        ? <><Check className="w-2.5 h-2.5" />Active</>
                        : "Dormant"
                      }
                    </span>
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    {modal.type === "edit" && modal.company.id === c.id ? (
                      <div className="inline-block text-left min-w-[240px]">
                        <CompanyForm
                          initial={c}
                          onSave={(fd) => handleEdit(c.id, fd)}
                          onCancel={() => setModal({ type: "none" })}
                        />
                      </div>
                    ) : modal.type === "delete" && modal.company.id === c.id ? (
                      <div className="inline-block text-left min-w-[260px]">
                        <DeleteConfirm
                          company={c}
                          onConfirm={() => handleDelete(c.id)}
                          onCancel={() => setModal({ type: "none" })}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setModal({ type: "edit", company: c })}
                          className="p-1.5 rounded-lg text-brand-gray-mid hover:text-brand-black hover:bg-brand-gray-light transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setModal({ type: "delete", company: c })}
                          className="p-1.5 rounded-lg text-brand-gray-mid hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
