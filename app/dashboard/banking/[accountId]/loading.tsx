export default function AccountDrillLoading() {
  return (
    <main className="flex-1 p-4 sm:p-6 max-w-5xl space-y-5 animate-pulse">
      <div className="h-4 w-40 bg-brand-gray-light rounded" />
      <div className="bg-white rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-gray-light" />
          <div className="space-y-2"><div className="h-5 w-48 bg-brand-gray-light rounded" /><div className="h-3 w-36 bg-brand-gray-light rounded" /></div>
        </div>
        <div className="flex gap-8 pt-3 border-t border-border">
          {[...Array(3)].map((_, i) => <div key={i} className="space-y-1.5"><div className="h-3 w-24 bg-brand-gray-light rounded" /><div className="h-6 w-20 bg-brand-gray-light rounded" /></div>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">{[...Array(2)].map((_, i) => <div key={i} className="rounded-xl border border-border bg-brand-gray-light h-28" />)}</div>
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="h-12 bg-brand-gray-light border-b border-border" />
        {[...Array(6)].map((_, i) => <div key={i} className="h-12 border-b border-border px-4 flex items-center gap-4"><div className="h-3 w-24 bg-brand-gray-light rounded" /><div className="h-3 w-40 bg-brand-gray-light rounded" /><div className="ml-auto h-3 w-16 bg-brand-gray-light rounded" /></div>)}
      </div>
    </main>
  );
}
