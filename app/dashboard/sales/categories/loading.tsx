export default function Loading() {
  return (
    <main className="flex-1 p-6 space-y-6 max-w-6xl animate-pulse">
      <div className="h-16 w-64 rounded-xl bg-brand-gray-light" />
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="h-11 bg-brand-gray-light border-b border-border" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-11 border-b border-border px-5 flex items-center gap-4">
            <div className="h-3 w-40 bg-brand-gray-light rounded" />
            <div className="ml-auto h-3 w-16 bg-brand-gray-light rounded" />
          </div>
        ))}
      </div>
    </main>
  );
}
