"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-xl font-semibold text-brand-black">Something went wrong</h2>
        <p className="text-sm text-brand-gray-mid">{error.message}</p>
        <Button
          onClick={reset}
          className="bg-brand-red hover:bg-brand-maroon text-white"
        >
          Try again
        </Button>
      </div>
    </main>
  );
}
