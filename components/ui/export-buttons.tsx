"use client";

/**
 * ExportButtons — reusable Download Excel + Download PDF button pair.
 *
 * Usage:
 *   <ExportButtons
 *     onExcelClick={() => downloadExcel(rows, "AP_Aging")}
 *     onPDFClick={() => printAsPDF(tableHtml, "AP Aging Report")}
 *   />
 *
 * Both callbacks are provided by the parent so each module can shape
 * its data exactly as it needs before calling the export utils.
 */

import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onExcelClick: () => void;
  onPDFClick:   () => void;
  disabled?:    boolean;
  size?:        "sm" | "default";
}

export function ExportButtons({ onExcelClick, onPDFClick, disabled, size = "sm" }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size={size}
        onClick={onExcelClick}
        disabled={disabled}
        className="gap-1.5 text-xs"
        title="Download as Excel (.xlsx)"
      >
        <Download className="w-3.5 h-3.5" />
        Excel
      </Button>
      <Button
        variant="outline"
        size={size}
        onClick={onPDFClick}
        disabled={disabled}
        className="gap-1.5 text-xs"
        title="Download as PDF"
      >
        <FileText className="w-3.5 h-3.5" />
        PDF
      </Button>
    </div>
  );
}
