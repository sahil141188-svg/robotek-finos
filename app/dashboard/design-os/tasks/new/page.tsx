/**
 * New Design Task — Management fills this form to assign work to designers.
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { createDesignTask } from "@/app/actions/design-os";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";

const TASK_TYPES = [
  "Social Post", "Instagram Story", "Facebook Ad", "Banner", "Brochure",
  "Catalogue", "Visiting Card", "Letterhead", "Packaging", "Video Ad",
  "Reel", "Logo", "Presentation", "Email Template", "Other",
];

const PLATFORMS = [
  "Instagram", "Facebook", "WhatsApp", "LinkedIn", "YouTube",
  "Print", "Website", "Email", "Multiple", "N/A",
];

export default function NewDesignTaskPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError("");
    startTransition(async () => {
      try {
        await createDesignTask(fd);
        router.push("/dashboard/design-os");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to create task");
      }
    });
  };

  return (
    <>
      <Header
        title="Assign Design Task"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Design OS", href: "/dashboard/design-os" },
          { label: "New Task" },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-4 sm:p-6 max-w-2xl">
        <Link
          href="/dashboard/design-os"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Task Details</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <Field label="Task Title" required>
              <input
                name="title"
                required
                placeholder="e.g. Diwali Sale Instagram Post"
                className="input"
              />
            </Field>

            {/* Type + Platform */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Task Type" required>
                <select name="task_type" required className="input">
                  <option value="">Select type…</option>
                  {TASK_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Platform">
                <select name="platform" className="input">
                  <option value="">Select…</option>
                  {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
            </div>

            {/* Assign to */}
            <Field label="Assign To" required>
              <select name="assigned_to" required className="input">
                <option value="">Select designer…</option>
                <option value="vishal">Vishal</option>
                <option value="nitin">Nitin</option>
                <option value="both">Both (Vishal & Nitin)</option>
              </select>
            </Field>

            {/* Deadline + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Deadline">
                <input type="date" name="deadline" className="input" />
              </Field>
              <Field label="Priority">
                <select name="priority" className="input" defaultValue="medium">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </Field>
            </div>

            {/* Description */}
            <Field label="Description / Brief">
              <textarea
                name="description"
                rows={3}
                placeholder="Describe what needs to be designed, key message, size requirements…"
                className="input resize-none"
              />
            </Field>

            {/* Reference URL */}
            <Field label="Reference URL">
              <input
                name="reference_url"
                type="url"
                placeholder="https://…"
                className="input"
              />
            </Field>

            {/* Notes */}
            <Field label="Additional Notes">
              <textarea
                name="notes"
                rows={2}
                placeholder="Colors, fonts, specific instructions…"
                className="input resize-none"
              />
            </Field>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
              {isPending ? "Assigning…" : "Assign Task to Designer"}
            </button>
          </form>
        </div>
      </main>

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
          transition: box-shadow 0.15s;
        }
        .input:focus {
          box-shadow: 0 0 0 2px #3b82f6;
          border-color: #3b82f6;
        }
      `}</style>
    </>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
