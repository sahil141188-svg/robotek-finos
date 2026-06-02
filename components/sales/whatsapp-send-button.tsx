"use client";

/**
 * Real WhatsApp SEND button — fires the message through FinOS's configured
 * WhatsApp API (Maytapi) via a server action. Confirms first so a real dealer
 * never gets messaged by accident.
 */
import { useState, useTransition } from "react";
import { MessageCircle, Check, AlertCircle } from "lucide-react";
import { sendChurnNudgeWhatsApp } from "@/app/actions/sales";

export function WhatsAppSendButton({ customerId, customerName }: { customerId: string; customerName: string }) {
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  function send() {
    if (!window.confirm(`Send a WhatsApp nudge to ${customerName} now?`)) return;
    start(async () => {
      const res = await sendChurnNudgeWhatsApp(customerId);
      if (res.ok) {
        setState("sent");
      } else {
        setState("error");
        setMsg(res.error ?? "Send failed");
      }
    });
  }

  if (state === "sent") {
    return (
      <span className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium bg-green-100 text-green-700">
        <Check className="w-4 h-4" /> Sent on WhatsApp
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        onClick={send}
        disabled={pending}
        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium text-white bg-[#25D366] hover:bg-[#1DA851] disabled:opacity-60 transition-colors"
      >
        <MessageCircle className="w-4 h-4" /> {pending ? "Sending…" : "Send WhatsApp now"}
      </button>
      {state === "error" && (
        <span className="inline-flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5" /> {msg}
        </span>
      )}
    </div>
  );
}
