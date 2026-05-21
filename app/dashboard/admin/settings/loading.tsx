export default function AdminSettingsLoading() {
  return (
    <main className="flex-1 p-4 sm:p-6 max-w-3xl space-y-6 animate-pulse">
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-9 w-28 bg-brand-gray-light rounded-lg" />
        ))}
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-white p-5 space-y-4">
          <div className="h-4 w-40 bg-brand-gray-light rounded" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="space-y-1.5">
                <div className="h-3 w-24 bg-brand-gray-light rounded" />
                <div className="h-9 bg-brand-gray-light rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
