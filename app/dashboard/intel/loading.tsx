export default function IntelLoading() {
  return (
    <div className="flex-1 p-4 sm:p-6 space-y-5 animate-pulse">
      {/* Header skeleton */}
      <div className="h-8 bg-brand-gray-light rounded-lg w-72" />

      {/* Health + briefing row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="h-56 bg-brand-gray-light rounded-2xl" />
        <div className="lg:col-span-2 h-56 bg-brand-gray-light rounded-2xl" />
      </div>

      {/* Alert cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-brand-gray-light rounded-2xl" />
        ))}
      </div>

      {/* Charts / tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="h-80 bg-brand-gray-light rounded-2xl" />
        <div className="h-80 bg-brand-gray-light rounded-2xl" />
      </div>
    </div>
  );
}
