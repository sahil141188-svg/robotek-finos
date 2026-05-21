"use client";

/**
 * StepIndicator — Horizontal step progress bar for the import wizard.
 * Steps: Select → Map Columns → Validate → Import
 */

import { Check } from "lucide-react";

export type WizardStep = "select" | "map" | "validate" | "import";

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "select",   label: "Select File"   },
  { id: "map",      label: "Map Columns"   },
  { id: "validate", label: "Validate"      },
  { id: "import",   label: "Import"        },
];

interface StepIndicatorProps {
  current: WizardStep;
}

export function StepIndicator({ current }: StepIndicatorProps) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const isDone    = idx < currentIdx;
        const isActive  = idx === currentIdx;
        const isPending = idx > currentIdx;

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            {/* Circle */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isDone
                    ? "bg-green-600 border-green-600 text-white"
                    : isActive
                    ? "bg-brand-red border-brand-red text-white"
                    : "bg-white border-border text-brand-gray-mid"
                }`}
              >
                {isDone ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium whitespace-nowrap ${
                  isActive
                    ? "text-brand-red"
                    : isDone
                    ? "text-green-600"
                    : "text-brand-gray-mid"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${
                  idx < currentIdx ? "bg-green-500" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
