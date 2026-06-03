"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importLeads, type ImportRow, type ImportResult } from "@/app/actions/crm-import";
import { Upload, Wand2, CheckCircle2, ArrowRight } from "lucide-react";

/** NBD target fields + synonyms for auto-mapping the sheet's headers. */
const FIELDS: { key: string; label: string; syn: string[] }[] = [
  { key: "name", label: "Lead name", syn: ["party name", "customer name", "name"] },
  { key: "company", label: "Company / firm", syn: ["company name", "firm name", "firm name/shop name", "firm"] },
  { key: "phone", label: "Phone", syn: ["phone no", "phone number", "phone num", "another phone no", "phone"] },
  { key: "email", label: "Email", syn: ["email address", "email id", "email"] },
  { key: "city", label: "Area / city", syn: ["area", "city", "full address", "location"] },
  { key: "state", label: "State", syn: ["state and ut", "state"] },
  { key: "enquiry_no", label: "Enquiry / SF / FSR no.", syn: ["sf num", "sf number", "unique code", "fsr num", "enquiry no", "enquiry no.", "enquiry num", "unique id", "unique key"] },
  { key: "enquiry_type", label: "Enquiry type", syn: ["enquiry type", "enquiry for", "customer type", "cutomer type"] },
  { key: "product_interest", label: "Product interest", syn: ["focused products", "enquiry for products", "products"] },
  { key: "existing_brand", label: "Existing brand", syn: ["existing brand", "existing products/brand selling"] },
  { key: "monthly_turnover", label: "Monthly turnover", syn: ["monthly sales", "current monthly turnover"] },
  { key: "investment_amount", label: "Investment amount", syn: ["investment amount"] },
  { key: "source", label: "Lead source", syn: ["sources of customer", "sources of customer(lead generate)", "source of customer", "source"] },
  { key: "assigned_name", label: "Assigned to (name)", syn: ["lead assigned to", "sales person assigned", "assigned to"] },
  { key: "filled_by", label: "Filled by (clerk)", syn: ["filled by", "filld by"] },
  { key: "sc_name", label: "SC name", syn: ["sc name", "sales coor. name", "sales coordinator"] },
  { key: "priority", label: "Priority", syn: ["lead priority type", "new lead type", "lead priority", "priority"] },
  { key: "external_status", label: "Status / stage", syn: ["stages", "status", "final status", "interested or not"] },
  { key: "lead_time_days", label: "Lead time (days)", syn: ["lead time", "lead time for next call", "next order lead time", "lead time in days"] },
  { key: "first_billing_date", label: "First billing date", syn: ["billing date", "first billing date", "first bill date"] },
  { key: "first_billing_amount", label: "First billing amount", syn: ["billing amount", "fist amount", "first bill amount", "purchased amount"] },
  { key: "dream_customer", label: "Dream customer", syn: ["dream customer"] },
  { key: "whatsapp_link", label: "WhatsApp link", syn: ["whatsapp link"] },
  { key: "visit_date", label: "Date of visit", syn: ["date of visit", "date of   visit"] },
  { key: "notes", label: "Remarks / notes", syn: ["remark", "remarks", "remark (other information)", "sc remark", "party remark", "special condition", "ss remark"] },
];

const norm = (s: string) => s.toLowerCase().replace(/&#10;|&#9;/g, " ").replace(/[\\_]/g, "").replace(/\s+/g, " ").trim().replace(/[.:]+$/, "");

function autoMap(headers: string[]): Record<string, string> {
  const normed = headers.map((h) => ({ h, n: norm(h) }));
  const map: Record<string, string> = {};
  for (const f of FIELDS) {
    const exact = normed.find((x) => f.syn.includes(x.n));
    const partial = exact ?? normed.find((x) => f.syn.some((s) => x.n === s || x.n.startsWith(s) || s.startsWith(x.n)));
    if (partial && !Object.values(map).includes(partial.h)) map[f.key] = partial.h;
  }
  return map;
}

export function LeadImport() {
  const router = useRouter();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"upload" | "map">("upload");
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  async function parseData(input: File | string) {
    try {
      const XLSX = await import("xlsx");
      let wb;
      if (typeof input === "string") wb = XLSX.read(input, { type: "string" });
      else wb = XLSX.read(await input.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const arr = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "", raw: false });
      if (!arr.length) { setErr("No rows found."); return; }
      const hdrs = (arr[0] as string[]).map((h) => String(h ?? "").trim()).filter(Boolean);
      const dataRows = (arr.slice(1) as string[][]).map((r) => {
        const o: Record<string, string> = {};
        hdrs.forEach((h, i) => { o[h] = String(r[i] ?? "").trim(); });
        return o;
      }).filter((o) => Object.values(o).some((v) => v));
      setHeaders(hdrs);
      setRows(dataRows);
      setMapping(autoMap(hdrs));
      setErr(null);
      setStep("map");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not parse the file.");
    }
  }

  function runImport() {
    const mapped: ImportRow[] = rows.map((r) => {
      const out: ImportRow = {};
      for (const f of FIELDS) {
        const src = mapping[f.key];
        if (src && r[src] != null) out[f.key] = r[src];
      }
      return out;
    });
    start(async () => {
      const res = await importLeads(mapped);
      setResult(res);
      router.refresh();
    });
  }

  if (result) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 text-center space-y-3">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
        <h2 className="text-lg font-bold text-brand-black">Import finished</h2>
        <p className="text-sm text-brand-gray-mid">
          <strong className="text-emerald-700">{result.inserted}</strong> imported ·{" "}
          <strong>{result.skipped}</strong> skipped (duplicates) ·{" "}
          <strong className={result.errors ? "text-red-600" : ""}>{result.errors}</strong> errors
        </p>
        {result.messages.map((m, i) => <p key={i} className="text-xs text-brand-gray-mid">{m}</p>)}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={() => { setResult(null); setStep("upload"); setRows([]); setHeaders([]); }} className="px-4 py-2 rounded-lg border border-border text-sm">Import another</button>
          <a href="/dashboard/sales-os/leads" className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon">View Leads</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      {step === "upload" && (
        <div className="rounded-xl border border-border bg-white p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2"><Upload className="w-4 h-4 text-brand-red" /> Upload your sheet</h2>
            <p className="text-xs text-brand-gray-mid mt-1">Export any tab from Google Sheets as <strong>.xlsx</strong> or <strong>.csv</strong> (File → Download), then drop it here. Or paste rows below.</p>
          </div>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseData(f); }}
            className="block w-full text-sm text-brand-gray-mid file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-red file:text-white file:text-sm file:font-medium hover:file:bg-brand-maroon" />
          <div className="text-xs text-brand-gray-mid">— or paste CSV (with a header row) —</div>
          <PasteBox onParse={(text) => parseData(text)} />
        </div>
      )}

      {step === "map" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-brand-black flex items-center gap-2"><Wand2 className="w-4 h-4 text-brand-red" /> Map columns</h2>
              <span className="text-xs text-brand-gray-mid">{rows.length} rows detected · columns auto-matched, adjust if needed</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-sm">
                  <span className="w-40 shrink-0 text-brand-gray-mid">{f.label}{f.key === "name" && " *"}</span>
                  <ArrowRight className="w-3 h-3 text-brand-gray-mid shrink-0" />
                  <select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                    className="flex-1 rounded-lg border border-border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                  >
                    <option value="">— skip —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-border bg-white p-5 overflow-x-auto">
            <h3 className="text-sm font-semibold text-brand-black mb-3">Preview (first 5)</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-brand-gray-mid border-b border-border">
                  {FIELDS.filter((f) => mapping[f.key]).map((f) => <th key={f.key} className="py-1.5 pr-3 font-medium whitespace-nowrap">{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {FIELDS.filter((f) => mapping[f.key]).map((f) => <td key={f.key} className="py-1.5 pr-3 whitespace-nowrap max-w-[160px] truncate text-brand-black">{r[mapping[f.key]] || "—"}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => { setStep("upload"); setRows([]); setHeaders([]); }} className="px-4 py-2 rounded-lg border border-border text-sm">Back</button>
            <button onClick={runImport} disabled={pending || !mapping.name} className="px-5 py-2.5 bg-brand-red text-white rounded-lg text-sm font-semibold hover:bg-brand-maroon disabled:opacity-60 transition-colors">
              {pending ? "Importing…" : `Import ${rows.length} leads`}
            </button>
          </div>
          {!mapping.name && <p className="text-xs text-red-600 text-right">Map the “Lead name” column to continue.</p>}
        </div>
      )}
    </div>
  );
}

function PasteBox({ onParse }: { onParse: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Paste rows here (first line = column headers)…"
        className="w-full rounded-lg border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-red/30" />
      <button onClick={() => text.trim() && onParse(text)} disabled={!text.trim()} className="px-4 py-2 rounded-lg border border-border text-sm hover:border-brand-red disabled:opacity-50">Use pasted data</button>
    </div>
  );
}
