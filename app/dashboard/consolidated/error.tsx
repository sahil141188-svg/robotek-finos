"use client";
import Link from "next/link";
export default function ConsolidatedError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex-1 p-6 flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-lg font-semibold text-brand-black">Failed to load consolidated dashboard</p>
        <p className="text-sm text-brand-gray-mid">{error.message}</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon transition-colors">
            Try again
          </button>
          <Link href="/dashboard" className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-brand-gray-mid hover:text-brand-black transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
