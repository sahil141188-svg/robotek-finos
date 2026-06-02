"use client";

import Link from "next/link";

export default function CustomerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex-1 p-6 flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-lg font-semibold text-brand-black">Failed to load customer</p>
        <p className="text-sm text-brand-gray-mid">{error.message}</p>
        <div className="flex items-center justify-center gap-2">
          <button onClick={reset} className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon transition-colors">
            Try again
          </button>
          <Link href="/dashboard/sales" className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-brand-black hover:bg-brand-gray-light transition-colors">
            Back to Sales
          </Link>
        </div>
      </div>
    </main>
  );
}
