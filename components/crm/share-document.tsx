"use client";

import { useState, useTransition } from "react";
import { shareDocument } from "@/app/actions/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Props {
  leadId: string;
  leadName: string;
  compact?: boolean;
}

export function ShareDocument({ leadId, leadName, compact }: Props) {
  const [open, setOpen]           = useState(false);
  const [remarks, setRemarks]     = useState("");
  const [driveUrl, setDriveUrl]   = useState("");
  const [qualified, setQualified] = useState(true);
  const [pending, start]          = useTransition();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!remarks.trim()) { toast.error("Enter remarks"); return; }
    start(async () => {
      const r = await shareDocument({
        leadId,
        remarks: remarks.trim(),
        driveUrl: driveUrl.trim() || undefined,
        markQualified: qualified,
      });
      if (r.error) { toast.error(r.error); return; }
      toast.success("Document sharing logged");
      setOpen(false);
      setRemarks("");
      setDriveUrl("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        {compact ? (
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1 text-xs border border-border",
              "hover:border-brand-red/60 hover:bg-brand-red/5 transition-colors"
            )}
            title="Share document / catalog"
          >
            <FileText className="w-3 h-3" />
            Doc
          </button>
        ) : (
          <Button variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-1" />
            Share Document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-red" />
            Share Document — {leadName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>What was shared? <span className="text-brand-red">*</span></Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Company catalog, Visiting card, Product photos, Price list…"
              rows={2}
              className="resize-none"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              Google Drive Link
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <div className="relative">
              <Input
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/…"
                type="url"
              />
              {driveUrl && (
                <a
                  href={driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-red hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={qualified}
              onChange={(e) => setQualified(e.target.checked)}
              className="rounded border-border accent-brand-red"
            />
            <span className="text-sm">Mark lead as <strong>Qualified</strong></span>
          </label>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={pending} className="bg-brand-red hover:bg-brand-maroon flex-1">
              {pending ? "Saving…" : "Log & Save"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
