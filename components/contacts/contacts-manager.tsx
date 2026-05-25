"use client";

/**
 * ContactsManager — directory + bulk-import.
 *
 *  - Table of all customers/vendors for the company with inline phone/email edit.
 *  - "Bulk import" button → modal: pick xlsx/csv → preview → commit.
 *  - "Download template" link emits a 5-row sample with the expected columns.
 *  - Filter tabs (All / Customers / Vendors), name search.
 */

import { useMemo, useRef, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import {
  commitContactImport, previewContactImport, updateContact,
  type ContactRow, type ImportRow, type ImportPreview,
} from "@/app/actions/contacts-import";
import {
  Upload, Download, Pencil, Check, X, Search, Phone, Mail, User,
  AlertCircle, CheckCircle2,
} from "lucide-react";

interface Props { contacts: ContactRow[]; }

type Filter = "All" | "Customers" | "Vendors";

export function ContactsManager({ contacts: initial }: Props) {
  const [contacts, setContacts] = useState<ContactRow[]>(initial);
  const [filter, setFilter]     = useState<Filter>("All");
  const [search, setSearch]     = useState("");
  const [editing, setEditing]   = useState<string | null>(null);
  const [eForm, setEForm]       = useState<{ phone: string; email: string; person: string }>({ phone: "", email: "", person: "" });
  const [busy, startTransition] = useTransition();
  const [toast, setToast]       = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Import modal state
  const fileInput = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen]   = useState(false);
  const [importRows, setImportRows]   = useState<ImportRow[]>([]);
  const [preview, setPreview]         = useState<ImportPreview | null>(null);
  const [step, setStep]               = useState<"pick" | "preview" | "done">("pick");
  const [result, setResult]           = useState<{
    updatedCustomers: number; updatedVendors: number;
    unmatched: number; noChange: number; errors: string[];
  } | null>(null);

  const filtered = useMemo(() => {
    let list = contacts;
    if (filter === "Customers") list = list.filter((c) => c.kind === "customer");
    if (filter === "Vendors")   list = list.filter((c) => c.kind === "vendor");
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.gstin ?? "").toLowerCase().includes(q),
    );
    return list;
  }, [contacts, filter, search]);

  const counts = useMemo(() => ({
    All: contacts.length,
    Customers: contacts.filter((c) => c.kind === "customer").length,
    Vendors:   contacts.filter((c) => c.kind === "vendor").length,
    MissingPhone: contacts.filter((c) => !c.phone).length,
  }), [contacts]);

  // ── Inline edit ────────────────────────────────────────────────────────

  function startEdit(c: ContactRow) {
    setEditing(c.id);
    setEForm({ phone: c.phone ?? "", email: c.email ?? "", person: c.contact_person ?? "" });
  }

  function saveEdit() {
    if (!editing) return;
    const id = editing;
    const c  = contacts.find((x) => x.id === id);
    if (!c) return;
    startTransition(async () => {
      const r = await updateContact({
        id, kind: c.kind,
        phone:  eForm.phone.trim() || null,
        email:  eForm.email.trim() || null,
        contact_person: eForm.person.trim() || null,
      });
      if (r.ok) {
        setContacts(contacts.map((x) => x.id === id ? {
          ...x,
          phone: eForm.phone.trim() || null,
          email: eForm.email.trim() || null,
          contact_person: eForm.person.trim() || null,
        } : x));
        setEditing(null);
        setToast({ kind: "ok", text: "Saved" });
      } else {
        setToast({ kind: "err", text: r.error ?? "Save failed" });
      }
    });
  }

  // ── Template download ──────────────────────────────────────────────────

  function downloadTemplate() {
    const sample = [
      ["Firm Name", "Phone", "Email", "Contact Person", "GSTIN"],
      ["VALEUR FABTEX PRIVATE LIMITED", "+91 98xxx xxxxx", "accounts@valeur.example", "Mr. Kumar", "06AAECV1281H1ZE"],
      ["GBN MERCHANDISING PVT LTD",     "+91 98xxx xxxxx", "ar@gbn.example",          "Ms. Sharma", ""],
      ["L Gupta & Associates",          "+91 98xxx xxxxx", "",                        "",           ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sample);
    ws["!cols"] = [{ wch: 36 }, { wch: 18 }, { wch: 32 }, { wch: 22 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contacts");
    XLSX.writeFile(wb, "robotek-contacts-template.xlsx");
  }

  // ── File parsing ───────────────────────────────────────────────────────

  async function onFile(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: "array", cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows  = XLSX.utils.sheet_to_json<Record<string, string | number | null>>(sheet, { defval: null });

      // Normalise column headers — accept Firm Name / Name / Account / Company, Phone / Mobile / Contact, Email / Mail
      const parsed: ImportRow[] = [];
      for (const r of rows) {
        const keys = Object.keys(r);
        const findKey = (re: RegExp) => keys.find((k) => re.test(k.toLowerCase()));
        const nameKey  = findKey(/firm|name|account|company|party|customer|vendor/);
        const phoneKey = findKey(/phone|mobile|contact\s*no|whatsapp/);
        const emailKey = findKey(/email|mail/);
        const personKey= findKey(/person|contact person|to\s+name/);
        const gstinKey = findKey(/gstin|gst no/);
        if (!nameKey) continue;
        const name = String(r[nameKey] ?? "").trim();
        if (!name) continue;
        parsed.push({
          name,
          phone:  phoneKey  ? String(r[phoneKey]  ?? "").trim() : undefined,
          email:  emailKey  ? String(r[emailKey]  ?? "").trim() : undefined,
          contact_person: personKey ? String(r[personKey] ?? "").trim() : undefined,
          gstin:  gstinKey  ? String(r[gstinKey]  ?? "").trim() : undefined,
        });
      }
      if (parsed.length === 0) {
        setToast({ kind: "err", text: "No rows with a recognisable firm/name column found." });
        return;
      }
      setImportRows(parsed);
      startTransition(async () => {
        const p = await previewContactImport(parsed);
        setPreview(p);
        setStep("preview");
      });
    } catch (e) {
      setToast({ kind: "err", text: (e as Error).message });
    }
  }

  function commit() {
    if (!preview || importRows.length === 0) return;
    startTransition(async () => {
      const r = await commitContactImport(importRows);
      setResult(r);
      setStep("done");
      // Refresh local list — re-fetch via revalidation, but for instant UX we patch locally
      setContacts((cur) => cur.map((c) => {
        const upd = preview.matched.find((m) => m.matchedTo.id === c.id);
        if (!upd) return c;
        const next = { ...c };
        for (const ch of upd.fieldChanges) (next as Record<string, string | null>)[ch.field] = ch.to;
        return next;
      }));
    });
  }

  function closeImport() {
    setImportOpen(false);
    setStep("pick"); setPreview(null); setResult(null); setImportRows([]);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <>
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-lg shadow-lg px-4 py-3 text-sm cursor-pointer ${toast.kind === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
             onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}

      {/* Header + actions */}
      <div className="bg-white rounded-xl border border-border p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-brand-black">Contact directory</h2>
          <p className="text-xs text-brand-gray-mid mt-0.5">
            {counts.All} contacts · {counts.Customers} customers · {counts.Vendors} vendors ·
            {counts.MissingPhone > 0 && <span className="text-amber-700 ml-1">{counts.MissingPhone} missing phone</span>}
          </p>
        </div>
        <button onClick={downloadTemplate}
          className="inline-flex items-center gap-1.5 h-9 rounded-lg px-3 text-xs font-semibold border border-border text-brand-gray-mid hover:bg-brand-gray-light">
          <Download className="w-3.5 h-3.5" /> Download template
        </button>
        <button onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-1.5 h-9 rounded-lg px-4 text-xs font-semibold bg-brand-red text-white hover:bg-brand-maroon">
          <Upload className="w-3.5 h-3.5" /> Bulk import (xlsx / csv)
        </button>
      </div>

      {/* Filter + search */}
      <div className="bg-white rounded-xl border border-border p-3 flex flex-wrap items-center gap-2">
        {(["All", "Customers", "Vendors"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
              filter === f ? "bg-brand-red text-white" : "text-brand-gray-mid hover:text-brand-black"
            }`}>
            {f} ({counts[f]})
          </button>
        ))}
        <div className="flex-1 max-w-xs ml-auto relative">
          <Search className="w-3.5 h-3.5 text-brand-gray-mid absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email, GSTIN…"
            className="w-full text-xs border border-border rounded-lg pl-8 pr-3 py-1.5" />
        </div>
      </div>

      {/* Contacts table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-brand-gray-light/95">
              <tr className="border-b border-border text-xs text-brand-gray-mid">
                <th className="px-3 py-2.5 text-left font-medium">Firm name</th>
                <th className="px-3 py-2.5 text-left font-medium w-20">Type</th>
                <th className="px-3 py-2.5 text-left font-medium w-40">Phone</th>
                <th className="px-3 py-2.5 text-left font-medium">Email</th>
                <th className="px-3 py-2.5 text-left font-medium w-32">Contact person</th>
                <th className="px-3 py-2.5 text-left font-medium w-32">GSTIN</th>
                <th className="px-3 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => (
                <tr key={c.kind + c.id} className={`hover:bg-brand-gray-light/40 ${!c.phone ? "bg-amber-50/30" : ""}`}>
                  <td className="px-3 py-2.5 font-medium text-brand-black">{c.name}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${c.kind === "customer" ? "bg-blue-100 text-blue-800 border-blue-200" : "bg-purple-100 text-purple-800 border-purple-200"}`}>
                      {c.kind}
                    </span>
                  </td>
                  {editing === c.id ? (
                    <>
                      <td className="px-3 py-2.5"><input value={eForm.phone}  onChange={(e) => setEForm({ ...eForm, phone: e.target.value })}  placeholder="+91 ..." className="w-full text-xs border border-border rounded px-2 py-1" /></td>
                      <td className="px-3 py-2.5"><input value={eForm.email}  onChange={(e) => setEForm({ ...eForm, email: e.target.value })}  placeholder="email" className="w-full text-xs border border-border rounded px-2 py-1" /></td>
                      <td className="px-3 py-2.5"><input value={eForm.person} onChange={(e) => setEForm({ ...eForm, person: e.target.value })} placeholder="Name" className="w-full text-xs border border-border rounded px-2 py-1" /></td>
                      <td className="px-3 py-2.5 text-[10px] font-mono text-brand-gray-mid">{c.gstin ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={saveEdit} disabled={busy} className="text-[10px] inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"><Check className="w-3 h-3" /></button>
                          <button onClick={() => setEditing(null)} className="text-[10px] inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-brand-gray-mid text-white"><X className="w-3 h-3" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2.5 text-xs">
                        {c.phone ? <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3 text-brand-gray-mid" />{c.phone}</span>
                                 : <span className="text-amber-700 inline-flex items-center gap-1 text-[10px]"><AlertCircle className="w-3 h-3" />Missing</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-brand-gray-mid truncate max-w-xs">
                        {c.email ? <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span> : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-brand-gray-mid">
                        {c.contact_person ? <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{c.contact_person}</span> : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] font-mono text-brand-gray-mid">{c.gstin ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => startEdit(c)}
                          className="text-[10px] inline-flex items-center gap-0.5 px-2 py-1 rounded border border-border text-brand-gray-mid hover:bg-brand-gray-light">
                          <Pencil className="w-3 h-3" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-xs text-brand-gray-mid">No contacts match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import modal */}
      {importOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-black">Bulk import contacts</h3>
              <button onClick={closeImport} className="text-brand-gray-mid hover:text-brand-black"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {step === "pick" && (
                <>
                  <div className="bg-brand-gray-light/40 rounded-lg p-4 space-y-2">
                    <p className="text-xs font-semibold text-brand-black">Expected columns (case-insensitive)</p>
                    <ul className="text-xs text-brand-gray-mid list-disc pl-5 space-y-0.5">
                      <li><strong>Firm Name</strong> (required) — also matches: Name / Account / Company / Party / Customer / Vendor</li>
                      <li><strong>Phone</strong> — also matches: Mobile / Contact No / WhatsApp</li>
                      <li><strong>Email</strong> — also matches: Mail</li>
                      <li><strong>Contact Person</strong> (optional)</li>
                      <li><strong>GSTIN</strong> (optional — used as a secondary match key)</li>
                    </ul>
                    <p className="text-[10px] text-brand-gray-mid pt-1">
                      Existing customers/vendors are matched by name (case- and punctuation-insensitive)
                      or GSTIN. Unmatched rows are flagged — they will <em>not</em> be auto-created.
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-3">
                    <Upload className="w-8 h-8 text-brand-gray-mid mx-auto" />
                    <p className="text-sm font-semibold text-brand-black">Pick an .xlsx / .csv file</p>
                    <p className="text-xs text-brand-gray-mid">First sheet, first row = column headers.</p>
                    <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
                      className="block mx-auto text-xs" />
                  </div>
                </>
              )}

              {step === "preview" && preview && (
                <>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <Tile label="Will update" value={preview.matched.length} color="bg-green-50 text-green-700" />
                    <Tile label="No change"   value={preview.noChange.length} color="bg-brand-gray-light text-brand-gray-mid" />
                    <Tile label="Unmatched"   value={preview.unmatched.length} color="bg-amber-50 text-amber-700" />
                  </div>

                  {preview.matched.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-brand-black mb-1.5">Updates ({preview.matched.length})</p>
                      <div className="max-h-60 overflow-y-auto border border-border rounded-lg">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-brand-gray-light text-[10px] text-brand-gray-mid">
                            <tr><th className="px-2 py-1.5 text-left">Firm</th><th className="px-2 py-1.5 text-left">Field</th><th className="px-2 py-1.5 text-left">From</th><th className="px-2 py-1.5 text-left">To</th></tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {preview.matched.flatMap((m) => m.fieldChanges.map((ch, i) => (
                              <tr key={`${m.matchedTo.id}-${ch.field}-${i}`}>
                                <td className="px-2 py-1.5 text-brand-black">{m.matchedTo.name}</td>
                                <td className="px-2 py-1.5 text-brand-gray-mid">{ch.field}</td>
                                <td className="px-2 py-1.5 text-brand-gray-mid line-through">{ch.from ?? "—"}</td>
                                <td className="px-2 py-1.5 text-green-700 font-semibold">{ch.to}</td>
                              </tr>
                            )))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {preview.unmatched.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-700 mb-1.5 inline-flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Unmatched ({preview.unmatched.length})
                      </p>
                      <p className="text-[10px] text-brand-gray-mid mb-1">
                        These names didn&apos;t match any existing customer or vendor. Add them manually first, or fix the name in your sheet to match.
                      </p>
                      <div className="max-h-32 overflow-y-auto border border-amber-200 bg-amber-50/50 rounded-lg text-xs">
                        <ul className="divide-y divide-amber-200">
                          {preview.unmatched.map((r, i) => (
                            <li key={i} className="px-2 py-1 text-amber-800">{r.name}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </>
              )}

              {step === "done" && result && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-green-800">
                      <p className="font-semibold">Import complete</p>
                      <p className="text-xs mt-1">
                        Updated {result.updatedCustomers} customer{result.updatedCustomers === 1 ? "" : "s"} ·
                        {" "}{result.updatedVendors} vendor{result.updatedVendors === 1 ? "" : "s"} ·
                        {" "}{result.noChange} unchanged ·
                        {" "}{result.unmatched} unmatched
                      </p>
                    </div>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800">
                      <p className="font-semibold mb-1">{result.errors.length} error{result.errors.length === 1 ? "" : "s"}:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border bg-brand-gray-light/40 flex items-center justify-end gap-2">
              {step === "preview" && (
                <>
                  <button onClick={closeImport} className="text-xs px-3 py-1.5 rounded-lg border border-border text-brand-gray-mid hover:bg-white">Cancel</button>
                  <button
                    onClick={commit}
                    disabled={busy || (preview?.matched.length ?? 0) === 0}
                    className="text-xs px-4 py-1.5 rounded-lg bg-brand-red text-white font-semibold hover:bg-brand-maroon disabled:bg-brand-gray-mid disabled:cursor-not-allowed">
                    {busy ? "Saving…" : `Update ${preview?.matched.length ?? 0} contact${preview?.matched.length === 1 ? "" : "s"}`}
                  </button>
                </>
              )}
              {step === "done" && (
                <button onClick={closeImport} className="text-xs px-4 py-1.5 rounded-lg bg-brand-red text-white font-semibold hover:bg-brand-maroon">Done</button>
              )}
              {step === "pick" && (
                <button onClick={closeImport} className="text-xs px-3 py-1.5 rounded-lg border border-border text-brand-gray-mid hover:bg-white">Close</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Tile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg p-3 ${color}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-0.5">{value}</p>
    </div>
  );
}
