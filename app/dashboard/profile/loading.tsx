export default function ProfileLoading() {
  return (
    <main className="flex-1 p-4 sm:p-6 max-w-xl space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-brand-gray-light" />
        <div className="space-y-2">
          <div className="h-5 w-40 bg-brand-gray-light rounded" />
          <div className="h-4 w-24 bg-brand-gray-light rounded" />
        </div>
      </div>
      <div className="h-px bg-brand-gray-light" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 w-24 bg-brand-gray-light rounded" />
          <div className="h-9 bg-brand-gray-light rounded-lg" />
        </div>
      ))}
    </main>
  );
}
