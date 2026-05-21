"use client";

/**
 * ComplianceDetailActions — inline status update form for the detail page.
 * Handles filed date, ack number, notes entry + server action submission.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateComplianceStatus } from "@/app/actions/compliance";
import { type ComplianceItem, type ComplianceStatus } from "@/lib/compliance-data";

const TODAY = "2026-05-21";

interface Props {
  item: ComplianceItem;
}

export function ComplianceDetailActions({ item }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess]        = useState(false);
  const [filedDate, setFiledDate]    = useState(TODAY);
  const [ackNumber, setAckNumber]    = useState(item.acknowledgement_number ?? "");
  const [notes, setNotes]            = useState(item.notes ?? "");

  const isDone = item.status === "filed" || item.status === "paid";
  const isPaymentType = ["TDS", "TCS", "PF", "ESI", "AdvanceTax", "ProfTax"].includes(item.category);
  const actionLabel = isPaymentType ? "Mark as Paid" : "Mark as Filed";
  const newStatus: ComplianceStatus = isPaymentType ? "paid" : "filed";

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await updateComplianceStatus({
        id:                     item.id,
        status:                 newStatus,
        filed_date:             filedDate || undefined,
        acknowledgement_number: ackNumber || undefined,
        notes:                  notes || undefined,
      });
      if (result.success) {
        setSuccess(true);
        setTimeout(() => router.push("/dashboard/compliance"), 1500);
      }
    });
  };

  const handleMarkNA = () => {
    startTransition(async () => {
      await updateComplianceStatus({ id: item.id, status: "not_applicable" });
      setSuccess(true);
      setTimeout(() => router.push("/dashboard/compliance"), 1500);
    });
  };

  if (success) {
    return (
      <div className="flex items-center gap-3 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <CheckCircle2 className="w-5 h-5" />
        <span className="text-sm font-medium">Status updated successfully! Redirecting…</span>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-brand-gray-mid">
          This item is already marked as <strong>{item.status}</strong>.
          You can update the filing details below.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-brand-black mb-1">Filed / Paid Date</label>
            <input
              type="date"
              value={filedDate}
              onChange={(e) => setFiledDate(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-black mb-1">
              Ack / Reference Number
            </label>
            <input
              type="text"
              placeholder="ARN / BSR / Challan no."
              value={ackNumber}
              onChange={(e) => setAckNumber(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red/30"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-black mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red/30 resize-none"
          />
        </div>
        <Button
          className="bg-brand-red hover:bg-brand-maroon text-white"
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Update Details
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-brand-black mb-1">
            {isPaymentType ? "Payment Date" : "Filing Date"}
          </label>
          <input
            type="date"
            value={filedDate}
            onChange={(e) => setFiledDate(e.target.value)}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-black mb-1">
            Acknowledgement / Reference Number <span className="text-brand-gray-mid font-normal">(optional)</span>
          </label>
          <input
            type="text"
            placeholder={isPaymentType ? "BSR code / Challan no." : "ARN / SRN"}
            value={ackNumber}
            onChange={(e) => setAckNumber(e.target.value)}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red/30"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-brand-black mb-1">
          Notes <span className="text-brand-gray-mid font-normal">(optional)</span>
        </label>
        <textarea
          placeholder="Any remarks about this filing..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red/30 resize-none"
        />
      </div>

      <div className="flex gap-2">
        <Button
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving…</>
            : <><CheckCircle2 className="w-4 h-4 mr-2" /> {actionLabel}</>
          }
        </Button>
        <Button
          variant="outline"
          onClick={handleMarkNA}
          disabled={isPending}
        >
          Mark N/A
        </Button>
      </div>
    </div>
  );
}
