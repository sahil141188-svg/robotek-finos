export default function AlertsLoading() {
  return (
    <main className="flex-1 p-4 sm:p-6 max-w-4xl space-y-5 animate-pulse">
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-brand-gray-light h-20" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-brand-gray-light h-16" />
        ))}
      </div>
      <div className="flex gap-1.5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-9 w-24 bg-brand-gray-light rounded-lg" />
        ))}
      </div>
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-white h-20 border-l-4 border-l-brand-gray-light" />
        ))}
      </div>
    </main>
  );
}
