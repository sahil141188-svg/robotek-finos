"use client";

import { useState, useTransition } from "react";
import { UploadZone, type UploadedFile } from "./upload-zone";
import { submitDesign } from "@/app/actions/design-os";
import { Send } from "lucide-react";

interface SubmitDesignFormProps {
  taskId: string;
  designerName: string;
  round: number;
}

export function SubmitDesignForm({ taskId, designerName, round }: SubmitDesignFormProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (files.length === 0) {
      setError("Please upload at least one file before submitting.");
      return;
    }
    setError("");

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("task_id", taskId);
        fd.set("submitted_by", designerName);
        fd.set("files_json", JSON.stringify(files));
        await submitDesign(fd);
        setDone(true);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Submission failed");
      }
    });
  };

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm font-medium">
        ✓ Design submitted successfully! Sarthak will review within 4 hours.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">
        Submit Design — Round {round}
      </h3>

      <UploadZone onFilesChange={setFiles} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || files.length === 0}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Send className="w-4 h-4" />
        {isPending ? "Submitting…" : "Submit for Review"}
      </button>
    </div>
  );
}
