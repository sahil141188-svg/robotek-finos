"use client";

/**
 * Error boundary for the Layer 3 transaction page.
 */

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function TransactionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex-1 p-6 flex items-center justify-center">
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center max-w-md space-y-4">
        <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <p className="font-semibold text-brand-black">Could not load transactions</p>
          <p className="text-sm text-brand-gray-mid mt-1">{error.message}</p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={reset}>
            Try again
          </Button>
          <Link
            href="/dashboard"
            className="text-xs text-brand-red hover:underline"
          >
            ← Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
