"use client";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <p className="text-3xl">⚠️</p>
        <h2 className="text-xl font-semibold">Admin panel error</h2>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button onClick={reset} className="!bg-brand-red !text-white">Try again</Button>
      </div>
    </main>
  );
}
