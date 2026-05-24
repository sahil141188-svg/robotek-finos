"use client";

/**
 * FileDropzone — Drag & drop + click-to-browse file upload component.
 * Supports .xlsx, .xls, .csv, .pdf files.
 * Shows the selected file name and a clear button once a file is chosen.
 */

import { useRef, useState, useCallback } from "react";
import { Upload, FileSpreadsheet, X, AlertCircle } from "lucide-react";

const ACCEPTED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel",    // .xls
  "text/csv",                    // .csv
  "application/pdf",             // .pdf
];
const ACCEPTED_EXTS = [".xlsx", ".xls", ".csv", ".pdf"];
const MAX_MB = 100;

interface FileDropzoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function FileDropzone({ onFile, disabled }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateAndSet = useCallback(
    (file: File | null) => {
      setError(null);
      if (!file) return;

      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED_EXTS.includes(ext)) {
        setError(`Unsupported file type: ${ext}. Use .xlsx, .xls, .csv or .pdf`);
        return;
      }

      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`File is too large (max ${MAX_MB} MB)`);
        return;
      }

      setSelected(file);
      onFile(file);
    },
    [onFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      validateAndSet(e.dataTransfer.files[0] ?? null);
    },
    [validateAndSet],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSet(e.target.files?.[0] ?? null);
  };

  const clear = () => {
    setSelected(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const sizeLabel = selected
    ? selected.size > 1024 * 1024
      ? `${(selected.size / 1024 / 1024).toFixed(1)} MB`
      : `${(selected.size / 1024).toFixed(0)} KB`
    : "";

  if (selected) {
    return (
      <div className="rounded-xl border-2 border-green-300 bg-green-50 p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-6 h-6 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-black truncate">{selected.name}</p>
          <p className="text-xs text-brand-gray-mid">{sizeLabel} · Ready to parse</p>
        </div>
        {!disabled && (
          <button
            onClick={clear}
            className="p-1.5 rounded-lg hover:bg-green-100 text-brand-gray-mid hover:text-brand-black transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-10 flex flex-col items-center gap-3 transition-all cursor-pointer ${
          disabled
            ? "opacity-50 cursor-not-allowed border-border"
            : dragging
            ? "border-brand-red bg-brand-red/5 scale-[1.01]"
            : "border-border hover:border-brand-red/50 hover:bg-brand-gray-light/50"
        }`}
      >
        <div
          className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
            dragging ? "bg-brand-red/10" : "bg-brand-gray-light"
          }`}
        >
          <Upload
            className={`w-7 h-7 transition-colors ${
              dragging ? "text-brand-red" : "text-brand-gray-mid"
            }`}
          />
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold text-brand-black">
            {dragging ? "Drop it here" : "Drag & drop your file"}
          </p>
          <p className="text-xs text-brand-gray-mid mt-1">
            or{" "}
            <span className="text-brand-red font-medium underline underline-offset-2">
              browse
            </span>{" "}
            to select
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {ACCEPTED_EXTS.map((ext) => (
            <span
              key={ext}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-gray-light text-brand-gray-mid"
            >
              {ext}
            </span>
          ))}
          <span className="text-[10px] text-brand-gray-mid self-center">
            · max {MAX_MB} MB
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTS.join(",")}
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
}
