export default function BankingLoading() {
  return (
    <main className="flex-1 p-4 sm:p-6 space-y-5 max-w-6xl animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="rounded-xl border border-border bg-brand-gray-light h-24" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <div key={i} className="rounded-xl border border-border bg-brand-gray-light h-32" />)}
      </div>
      <div className="bg-white rounded-xl border border-border p-5 h-72">
        <div className="h-4 w-48 bg-brand-gray-light rounded mb-4" />
        <div className="h-52 bg-brand-gray-light rounded" />
      </div>
    </main>
  );
}
