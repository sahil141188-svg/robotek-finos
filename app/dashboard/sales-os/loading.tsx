export default function CrmLoading() {
  return (
    <main className="flex-1 p-6 space-y-6 max-w-6xl animate-pulse">
      <div className="h-12 rounded-xl bg-brand-gray-light" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-brand-gray-light h-24" />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-border p-5 h-40" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-brand-gray-light h-40" />
        <div className="rounded-xl border border-border bg-brand-gray-light h-40" />
      </div>
    </main>
  );
}
