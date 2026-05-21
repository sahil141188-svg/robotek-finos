"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ComplianceDetailError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex-1 p-6 flex items-center justify-center">
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center max-w-md space-y-4">
        <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <p className="font-semibold text-brand-black">Compliance item not found</p>
        <p className="text-sm text-brand-gray-mid">{error.message}</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={reset}>Try again</Button>
          <Link href="/dashboard/compliance">
            <Button size="sm" className="bg-brand-red hover:bg-brand-maroon text-white">
              Back to Calendar
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
