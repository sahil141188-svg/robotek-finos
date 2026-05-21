"use client";

/**
 * export-utils — shared helpers for downloading data as Excel (.xlsx) or PDF.
 *
 * Excel: uses the xlsx package (already installed for import) to write a
 *        workbook directly in the browser.
 * PDF:   uses the browser's native window.print() with a hidden print-only
 *        <div> injected into the DOM so we can print any arbitrary HTML table
 *        without navigating away. No extra dependencies needed.
 *
 * Both helpers are client-only — they rely on window / document.
 */

import * as XLSX from "xlsx";

// ── Excel export ──────────────────────────────────────────────────────────────

/**
 * Download an array of plain objects as a formatted .xlsx file.
 *
 * @param rows     - Array of objects; keys become column headers
 * @param filename - Desired filename WITHOUT the .xlsx extension
 * @param sheetName - Optional worksheet tab name (default: "Export")
 * @param colWidths - Optional array of {wch: number} column widths
 */
export function downloadExcel(
  rows: Record<string, unknown>[],
  filename: string,
  sheetName = "Export",
  colWidths?: { wch: number }[]
): void {
  if (!rows.length) return;

  const ws = XLSX.utils.json_to_sheet(rows);

  // Apply column widths if provided
  if (colWidths) ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ── PDF export (print-to-PDF via browser) ─────────────────────────────────────

/**
 * Open a print dialog showing only the provided HTML string.
 * The browser's "Save as PDF" option (or a physical printer) handles the rest.
 *
 * @param htmlContent - Full HTML string to print (table markup etc.)
 * @param title       - Document title shown in the print dialog header
 */
export function printAsPDF(htmlContent: string, title: string): void {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    alert("Please allow pop-ups to download the PDF.");
    return;
  }

  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11px;
      color: #1F1B20;
      padding: 24px 32px;
    }
    h1 { font-size: 16px; font-weight: 700; margin-bottom: 4px; color: #E52D31; }
    p.subtitle { font-size: 10px; color: #9A9596; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th {
      background: #1F1B20;
      color: #fff;
      text-align: left;
      padding: 6px 8px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    td { padding: 5px 8px; border-bottom: 1px solid #F5F4F4; }
    tr:nth-child(even) td { background: #FAFAFA; }
    tfoot td { font-weight: 700; background: #F5F4F4; border-top: 2px solid #1F1B20; }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 99px;
      font-size: 9px;
      font-weight: 600;
    }
    .badge-red    { background: #fef2f2; color: #dc2626; }
    .badge-yellow { background: #fefce8; color: #ca8a04; }
    .badge-green  { background: #f0fdf4; color: #16a34a; }
    .badge-gray   { background: #f5f4f4; color: #6b7280; }
    footer { margin-top: 24px; font-size: 9px; color: #9A9596; border-top: 1px solid #F5F4F4; padding-top: 8px; }
    @media print {
      @page { margin: 15mm 12mm; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  ${htmlContent}
  <footer>
    Robotek FinOS &nbsp;·&nbsp; Exported ${new Date().toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    })} &nbsp;·&nbsp; Confidential
  </footer>
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
</body>
</html>`);
  printWindow.document.close();
}
