"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function TaskDetailError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex-1 p-6 flex items-center justify-center">
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center max-w-md space-y-4">
        <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
        <p className="font-semibold text-brand-black">Task not found</p>
        <p className="text-sm text-brand-gray-mid">{error.message}</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={reset}>Retry</Button>
          <Link href="/dashboard/tasks"><Button size="sm" className="bg-brand-red hover:bg-brand-maroon text-white">Back to Tasks</Button></Link>
        </div>
      </div>
    </div>
  );
}
