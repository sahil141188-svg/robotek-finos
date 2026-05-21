"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TasksError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex-1 p-6 flex items-center justify-center">
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center max-w-md space-y-4">
        <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
        <p className="font-semibold text-brand-black">Task Manager failed to load</p>
        <p className="text-sm text-brand-gray-mid">{error.message}</p>
        <Button variant="outline" size="sm" onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
