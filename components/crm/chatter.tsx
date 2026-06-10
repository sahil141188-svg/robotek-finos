"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logNote } from "@/app/actions/crm-chatter";
import type { ChatMessage } from "@/lib/crm/detail";
import { MessageSquare, History, StickyNote, Send } from "lucide-react";

function timeAgo(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function Chatter({ parentType, parentId, messages }: { parentType: string; parentId: string; messages: ChatMessage[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const r = await logNote({ parentType, parentId, body });
      if (r.error) { setErr(r.error); return; }
      setErr(null); setBody(""); router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-brand-black flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-brand-red" /> Chatter
      </h3>

      {/* Composer */}
      <div className="flex items-start gap-2 mb-4">
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)} rows={2}
          placeholder="Log a note… (internal — not sent to the customer)"
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
        />
        <button onClick={submit} disabled={pending || !body.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon disabled:opacity-60 transition-colors shrink-0">
          <Send className="w-4 h-4" />{pending ? "…" : "Log"}
        </button>
      </div>
      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 mb-3">{err}</div>}

      {/* Timeline */}
      {messages.length === 0 ? (
        <p className="text-sm text-brand-gray-mid">No activity yet. Notes and changes will appear here.</p>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className="flex items-start gap-2.5">
              <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${m.kind === "log" ? "bg-brand-gray-light text-brand-gray-mid" : "bg-brand-red/10 text-brand-red"}`}>
                {m.kind === "log" ? <History className="w-3.5 h-3.5" /> : <StickyNote className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm ${m.kind === "log" ? "text-brand-gray-mid italic" : "text-brand-black"}`}>{m.body}</div>
                <div className="text-[11px] text-brand-gray-mid mt-0.5">
                  {m.author_name ?? "System"} · {timeAgo(m.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
