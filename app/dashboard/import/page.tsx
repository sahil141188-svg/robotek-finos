"use client";

/**
 * Import Data Page — Module 2: Data Import Engine (Day 3)
 *
 * 4-step wizard:
 *   Step 1 (select)   — choose module + drag-drop file → auto-parse client-side
 *   Step 2 (map)      — review / correct Busy column mapping
 *   Step 3 (validate) — preview valid rows, see errors / duplicates
 *   Step 4 (import)   — server action writes to Supabase → result screen
 *
 * RULE 3: "Import / Update Data" button on every module links here.
 * RULE 10: Every import logged in file_imports with 24-hour rollback.
 */

import { useState, useCallback, useTransition, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { StepIndicator, type WizardStep } from "@/components/import/step-indicator";
import { FileDropzone } from "@/components/import/file-dropzone";
import { ColumnMapper } from "@/components/import/column-mapper";
import { ValidationSummary } from "@/components/import/validation-summary";
import { Button } from "@/components/ui/button";
import {
  parseExcelFile,
  autoDetectColumns,
  autoDetectModule,
  applyMapping,
  validateRows,
  IMPORT_MODULES,
  BANK_STATEMENT_MAPPING,
  type ParsedFile,
  type ColumnMapping,
  type ValidationResult,
  type ModuleDetectionResult,
} from "@/lib/import-utils";
import { importTransactions } from "@/app/actions/import";
import type { ImportResult } from "@/app/actions/import";
import { importBankStatement } from "@/app/actions/import-banking";
import type { BankImportResult } from "@/app/actions/import-banking";
import type { BankAccountMetadata } from "@/app/actions/parsers/types";
import type { RawRow } from "@/lib/import-utils";
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Loader2,
  FileSpreadsheet,
  Upload,
  AlertTriangle,
} from "lucide-react";

// ─── Page component ───────────────────────────────────────────────────────────

export default function ImportPage() {
  const searchParams = useSearchParams();
  const defaultModule = searchParams.get("module") ?? "transactions";

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [step, setStep]             = useState<WizardStep>("select");
  const [selectedModule, setModule] = useState(defaultModule);
  const [file, setFile]             = useState<File | null>(null);
  const [parsed, setParsed]         = useState<ParsedFile | null>(null);
  const [mapping, setMapping]       = useState<ColumnMapping>({
    transaction_date: null, voucher_number: null, voucher_type: null,
    ledger_name: null, dr_amount: null, cr_amount: null, narration: null,
  });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importResult, setResult]   = useState<ImportResult | BankImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isPDF, setIsPDF]           = useState(false);
  const [pdfPages, setPdfPages]     = useState<number | null>(null);
  const [bankMetadata, setBankMetadata] = useState<BankAccountMetadata | null>(null);
  const [autoDetected, setAutoDetected] = useState<ModuleDetectionResult | null>(null);
  const [isParsing, startParsing]   = useTransition();
  const [isImporting, startImport]  = useTransition();
  // Bug #9 fix: track whether user explicitly clicked a module card so
  // auto-detection in handleFile does not silently override their choice.
  const moduleManuallySelectedRef = useRef(!!searchParams.get("module"));
  // Bug #4 fix: date format selector — default to Indian DD-MM-YYYY (Busy standard).
  const [dateFormat, setDateFormat] = useState<"DD-MM-YYYY" | "MM-DD-YYYY" | "auto">("DD-MM-YYYY");

  // ── Step 1: File selected → parse (client-side for Excel, server-side for PDF)
  const handleFile = useCallback((f: File) => {
    setFile(f);
    setParseError(null);
    setParsed(null);
    setPdfPages(null);
    setAutoDetected(null);
    setMapping({ transaction_date: null, voucher_number: null, voucher_type: null,
      ledger_name: null, dr_amount: null, cr_amount: null, narration: null });

    const fileIsPDF = f.name.toLowerCase().endsWith(".pdf") || f.type === "application/pdf";
    setIsPDF(fileIsPDF);

    startParsing(async () => {
      try {
        if (fileIsPDF) {
          // PDF: POST the raw binary to /api/parse-pdf (Route Handler).
          // Route Handlers receive req.arrayBuffer() directly — no JSON encoding,
          // no busboy multipart parser — so large PDFs (up to 100 MB) work on Vercel.
          const httpRes = await fetch("/api/parse-pdf", {
            method:  "POST",
            body:    f,
            headers: { "x-file-name": f.name },
          });
          const res = await httpRes.json() as {
            success: boolean;
            data?: ParsedFile;
            bankMetadata?: BankAccountMetadata;
            pages?: number;
            error?: string;
          };
          if (!res.success || !res.data) {
            throw new Error(res.error ?? "PDF parsing failed.");
          }
          // PDFs always resolve to bank_statement — set a high-confidence result
          setModule("bank_statement");
          setAutoDetected({
            moduleId:   "bank_statement",
            confidence: "high",
            reason:     res.bankMetadata
              ? `${res.bankMetadata.bankName} account ending ···${res.bankMetadata.accountNumber?.slice(-4) ?? "????"}  detected`
              : "PDF bank statement detected",
          });
          setPdfPages(res.pages ?? null);
          setParsed(res.data);
          setBankMetadata(res.bankMetadata ?? null);
          setMapping(BANK_STATEMENT_MAPPING);
        } else {
          // Excel / CSV: parse client-side then run module + column detection.
          // Bug #5 fix: parseExcelFile now preprocesses CSV Indian commas.
          const result = await parseExcelFile(f);
          // Bug #1 & #2 fix: pass current module so AP/AR amount column is detected.
          // Bug #9 fix: only auto-override module selection if user hasn't manually picked one.
          const currentModule = moduleManuallySelectedRef.current ? selectedModule : undefined;
          const detected = autoDetectColumns(result.headers, currentModule);
          const mod      = autoDetectModule(result.headers);
          setParsed(result);
          setMapping(detected);
          setAutoDetected(mod);
          if (!moduleManuallySelectedRef.current) {
            setModule(mod.moduleId);
          }
        }
      } catch (err) {
        // Next.js wraps unhandled server-action errors in a generic "Server Components
        // render" message (digest error). Detect that and show a meaningful fallback
        // so the user knows what to do rather than seeing an internal error string.
        const raw = err instanceof Error ? err.message : String(err);
        const isNextjsDigest =
          raw.includes("Server Components") ||
          raw.includes("digest") ||
          raw.includes("omitted in production");
        setParseError(
          isNextjsDigest
            ? "PDF parsing failed on the server. Please try a different PDF, or export the statement as Excel/CSV from your bank's net banking portal."
            : raw
        );
      }
    });
  }, [selectedModule]); // selectedModule needed for module-aware column detection

  // ── Step 2 → 3: Apply mapping and validate ────────────────────────────────
  const handleToValidate = () => {
    if (!parsed) return;
    // Bug #4 fix: pass selected date format; Bug #3 fix: pass module to skip
    // ledger_name requirement for compliance imports.
    const { mapped } = applyMapping(parsed.rows, mapping, dateFormat);
    const result = validateRows(mapped, selectedModule);
    setValidation(result);
    setStep("validate");
  };

  // ── Step 3 → 4: Run server action import ─────────────────────────────────
  const handleImport = () => {
    if (!validation || !file || !parsed) return;
    startImport(async () => {
      const ext = (file.name.split(".").pop()?.toLowerCase() ?? "xlsx") as
        "xlsx" | "xls" | "csv" | "pdf";

      // For bank statements, use the specialized import action
      if (selectedModule === "bank_statement" && isPDF && bankMetadata !== undefined) {
        const result = await importBankStatement(bankMetadata, parsed.rows as RawRow[], file.name);
        setResult(result);
      } else {
        // For other modules, use the standard import action
        const result = await importTransactions(validation.valid, file.name, ext, selectedModule);
        setResult(result);
      }
      setStep("import");
    });
  };

  const reset = () => {
    setStep("select");
    setFile(null);
    setParsed(null);
    setBankMetadata(null);
    setAutoDetected(null);
    setMapping({ transaction_date: null, voucher_number: null, voucher_type: null,
      ledger_name: null, dr_amount: null, cr_amount: null, narration: null });
    setValidation(null);
    setResult(null);
    setParseError(null);
    setIsPDF(false);
    setPdfPages(null);
    moduleManuallySelectedRef.current = false; // Bug #9 fix: allow auto-detect on next upload
    setDateFormat("DD-MM-YYYY"); // Reset date format to Indian default
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <Header
        title="Import / Update Data"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Import Data" },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-6 space-y-6 max-w-4xl">

        {/* Step bar */}
        <div className="bg-white rounded-xl border border-border p-5">
          <StepIndicator current={step} />
        </div>

        {/* ── Step 1: Select ────────────────────────────────────────────── */}
        {step === "select" && (
          <div className="space-y-5">
            {/* Module picker */}
            <div className="bg-white rounded-xl border border-border p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-brand-black">1. What are you importing?</h3>
                <p className="text-xs text-brand-gray-mid mt-1">
                  Choose the module so we can auto-detect the right column structure
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {IMPORT_MODULES.map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => { setModule(mod.id); moduleManuallySelectedRef.current = true; }}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      selectedModule === mod.id
                        ? "border-brand-red bg-brand-red/5"
                        : "border-border hover:border-brand-red/30 hover:bg-brand-gray-light/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{mod.icon}</span>
                      <div>
                        <p className={`text-sm font-semibold ${selectedModule === mod.id ? "text-brand-red" : "text-brand-black"}`}>
                          {mod.label}
                        </p>
                        <p className="text-xs text-brand-gray-mid mt-0.5">{mod.description}</p>
                        <p className="text-[10px] text-brand-gray-mid/70 mt-1.5 font-mono">
                          {mod.sampleColumns.slice(0, 5).join(" · ")}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Auto-detection hint — shown after a file is parsed */}
              {autoDetected && (
                <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
                  autoDetected.confidence === "high"
                    ? "bg-green-50 border-green-200 text-green-800"
                    : autoDetected.confidence === "medium"
                    ? "bg-blue-50 border-blue-200 text-blue-800"
                    : "bg-amber-50 border-amber-200 text-amber-800"
                }`}>
                  <span className="text-base leading-none mt-0.5">
                    {autoDetected.confidence === "high" ? "✓" : autoDetected.confidence === "medium" ? "~" : "?"}
                  </span>
                  <span>
                    <span className="font-semibold">
                      Auto-detected:{" "}
                      {IMPORT_MODULES.find((m) => m.id === autoDetected.moduleId)?.label ?? autoDetected.moduleId}
                    </span>
                    {" "}
                    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none ${
                      autoDetected.confidence === "high"
                        ? "bg-green-200 text-green-900"
                        : autoDetected.confidence === "medium"
                        ? "bg-blue-200 text-blue-900"
                        : "bg-amber-200 text-amber-900"
                    }`}>
                      {autoDetected.confidence} confidence
                    </span>
                    {" — "}
                    {autoDetected.reason}
                    <span className="ml-1 text-[10px] opacity-70">(you can override above)</span>
                  </span>
                </div>
              )}
            </div>

            {/* Dropzone */}
            <div className="bg-white rounded-xl border border-border p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-brand-black">2. Upload your Busy export file</h3>
                <p className="text-xs text-brand-gray-mid mt-1">
                  In Busy: Reports → Export → Excel. Set your date range, export as .xlsx or .csv
                </p>
              </div>
              <FileDropzone onFile={handleFile} disabled={isParsing} />

              {isParsing && (
                <div className="flex items-center gap-2 text-sm text-brand-gray-mid bg-brand-gray-light/60 border border-border rounded-lg px-3 py-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-red shrink-0" />
                  {isPDF
                    ? "Sending PDF to server for parsing… (this may take a few seconds)"
                    : "Parsing file and auto-detecting columns…"}
                </div>
              )}
              {parseError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-3 space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <XCircle className="w-4 h-4 shrink-0" /> Failed to parse file
                  </div>
                  <p className="text-xs leading-relaxed">{parseError}</p>
                  {isPDF && (
                    <p className="text-xs text-red-600 mt-1">
                      💡 Tip: Download the statement directly from your bank&apos;s net banking portal (not a forwarded/printed PDF) for best results. Alternatively, export as Excel/CSV.
                    </p>
                  )}
                </div>
              )}
              {parsed && !isParsing && (
                <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    {isPDF
                      ? <><strong>{parsed.totalRows}</strong> transactions extracted from PDF ({pdfPages} page{pdfPages !== 1 ? "s" : ""}). Column mapping set automatically.</>
                      : <>Parsed <strong>{parsed.totalRows}</strong> rows from sheet &quot;{parsed.sheetName}&quot; · {parsed.headers.length} columns found</>
                    }
                  </div>
                </div>
              )}
            </div>

            {/* Busy export instructions */}
            <div className="bg-white rounded-xl border border-border p-5 space-y-3">
              <h3 className="text-xs font-semibold text-brand-black uppercase tracking-wide">
                How to export from Busy Accounting Software
              </h3>
              <ol className="space-y-1.5 text-xs text-brand-gray-mid list-decimal list-inside">
                <li>Open Busy → go to <strong className="text-brand-black">Reports</strong> menu</li>
                <li>Select the report (Day Book, Sales Register, Ledger Report…)</li>
                <li>Click <strong className="text-brand-black">Export</strong> → choose <strong className="text-brand-black">Excel (.xlsx)</strong></li>
                <li>Set date range from <strong className="text-brand-black">01 April</strong> for full financial year</li>
                <li>Save and drag the file into the box above</li>
              </ol>
              <div className="flex flex-wrap gap-2 pt-1">
                {["Day Book","Sales Register","Purchase Register","Ledger-wise Report","Vendor Outstanding","Customer Outstanding"].map((r) => (
                  <span key={r} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-gray-light text-brand-gray-mid border border-border">
                    {r}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              {/* PDF bank statements skip the column mapper (auto-mapped) */}
              {isPDF ? (
                <Button
                  onClick={() => {
                    if (!parsed) return;
                    const { mapped } = applyMapping(parsed.rows, mapping, dateFormat);
                    const result = validateRows(mapped, selectedModule);
                    setValidation(result);
                    setStep("validate");
                  }}
                  disabled={!parsed || isParsing}
                  className="bg-brand-red hover:bg-brand-maroon text-white"
                >
                  Review Transactions <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={() => setStep("map")}
                  disabled={!parsed || isParsing}
                  className="bg-brand-red hover:bg-brand-maroon text-white"
                >
                  Review Column Mapping <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Map Columns ─────────────────────────────────────────── */}
        {step === "map" && parsed && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-border p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-brand-black">Map columns to schema</h3>
                <p className="text-xs text-brand-gray-mid mt-1">
                  We auto-detected the mapping from Busy&apos;s typical format. Adjust any mismatches below.
                </p>
              </div>
              <ColumnMapper
                headers={parsed.headers}
                mapping={mapping}
                previewRows={parsed.rows.slice(0, 5)}
                onChange={setMapping}
                module={selectedModule}
                dateFormat={dateFormat}
                onDateFormatChange={(f) => setDateFormat(f as "DD-MM-YYYY" | "MM-DD-YYYY" | "auto")}
              />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("select")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                onClick={handleToValidate}
                // Bug #3 fix: compliance module doesn't require ledger_name
                disabled={!mapping.transaction_date || (selectedModule !== "compliance" && !mapping.ledger_name)}
                className="bg-brand-red hover:bg-brand-maroon text-white"
              >
                Validate Data <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Validate ────────────────────────────────────────────── */}
        {step === "validate" && validation && parsed && file && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-border p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-brand-black">Validation results</h3>
                <p className="text-xs text-brand-gray-mid mt-1">
                  Rows with errors will be skipped. Review before confirming the import.
                </p>
              </div>
              <ValidationSummary result={validation} totalRows={parsed.totalRows} fileName={file.name} />
            </div>

            {validation.valid.length === 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">No valid rows to import</p>
                  <p className="text-xs text-red-600 mt-1">
                    All rows failed validation. Go back and fix the column mapping or check the source file.
                  </p>
                </div>
              </div>
            )}

            {validation.duplicates.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {validation.duplicates.length} duplicate voucher{validation.duplicates.length > 1 ? "s" : ""} in this file
                  </p>
                  <p className="text-xs text-amber-700 mt-1 font-mono">
                    {validation.duplicates.slice(0, 6).join(", ")}
                    {validation.duplicates.length > 6 && ` +${validation.duplicates.length - 6} more`}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("map")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={validation.valid.length === 0 || isImporting}
                className="bg-brand-red hover:bg-brand-maroon text-white"
              >
                {isImporting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing…</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" /> Import {validation.valid.length} rows</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Result ──────────────────────────────────────────────── */}
        {step === "import" && importResult && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-border p-10 text-center space-y-5">
              {importResult.success ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-9 h-9 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-brand-black">Import Complete!</h3>
                    <p className="text-brand-gray-mid mt-2">
                      {selectedModule === "bank_statement" ? (
                        <>
                          <span className="text-3xl font-extrabold text-green-600">
                            {(importResult as BankImportResult).transactionsImported}
                          </span>
                          <span className="text-sm ml-2">transactions from</span>
                          <span className="text-3xl font-extrabold text-green-600 ml-2">
                            {(importResult as BankImportResult).accountsImported}
                          </span>
                          <span className="text-sm ml-2">bank account{(importResult as BankImportResult).accountsImported !== 1 ? "s" : ""}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-3xl font-extrabold text-green-600">
                            {(importResult as ImportResult).rowsImported}
                          </span>
                          <span className="text-sm ml-2">transactions written to the database</span>
                        </>
                      )}
                    </p>
                    {importResult.errors.length > 0 && (
                      <p className="text-sm text-red-600 mt-1">{importResult.errors.length} row{importResult.errors.length !== 1 ? "s" : ""} failed</p>
                    )}
                  </div>
                  <p className="text-xs text-brand-gray-mid">
                    Import ID: <code className="font-mono bg-brand-gray-light px-1.5 py-0.5 rounded">{importResult.importId}</code>
                    {" · "}Rollback available for 24 hours
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto">
                    <XCircle className="w-9 h-9 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-brand-black">Import Failed</h3>
                    <p className="text-sm text-brand-gray-mid mt-1">{importResult.errors[0] ?? "Unexpected error"}</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="w-4 h-4 mr-2" /> Import another file
              </Button>
              <Button
                onClick={() => {
                  const url = selectedModule === "bank_statement" ? "/dashboard/banking" : "/dashboard";
                  window.location.href = url;
                }}
                className="bg-brand-red hover:bg-brand-maroon text-white"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" /> View Dashboard
              </Button>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
