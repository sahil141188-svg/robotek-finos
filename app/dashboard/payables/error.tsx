"use client";

export default function PayablesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex-1 p-6 flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-lg font-semibold text-brand-black">Failed to load Accounts Payable</p>
        <p className="text-sm text-brand-gray-mid">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon transition-colors"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
