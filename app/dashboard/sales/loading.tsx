export default function SalesLoading() {
  return (
    <main className="flex-1 p-6 space-y-6 max-w-6xl animate-pulse">
      <div className="h-12 rounded-xl bg-brand-gray-light" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-brand-gray-light h-24" />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="h-14 bg-brand-gray-light border-b border-border" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 border-b border-border px-5 flex items-center gap-4">
            <div className="h-3 w-40 bg-brand-gray-light rounded" />
            <div className="ml-auto h-3 w-12 bg-brand-gray-light rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-border p-5 h-64" />
    </main>
  );
}
