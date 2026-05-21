export default function ReviewLoading() {
  return (
    <main className="flex-1 p-6 max-w-6xl space-y-5 animate-pulse">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="h-9 w-56 bg-brand-gray-light rounded-xl" />
        <div className="h-9 w-32 bg-brand-gray-light rounded-lg" />
      </div>
      {/* Health bar */}
      <div className="bg-white rounded-xl border border-border p-5 space-y-3">
        <div className="h-5 w-48 bg-brand-gray-light rounded" />
        <div className="h-3 w-64 bg-brand-gray-light rounded-full" />
        <div className="h-4 w-full bg-brand-gray-light rounded mt-4" />
      </div>
      {/* Scorecard sections */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="h-10 bg-brand-gray-light border-b border-border" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-x divide-border">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="p-4 space-y-2">
                <div className="h-3 w-24 bg-brand-gray-light rounded" />
                <div className="h-6 w-20 bg-brand-gray-light rounded" />
                <div className="h-3 w-28 bg-brand-gray-light rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
