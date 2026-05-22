"use client";
export default function Error({ error }: { error: Error }) {
  return (
    <div className="flex-1 p-6 flex items-center justify-center">
      <div className="text-center space-y-2">
        <p className="font-semibold text-brand-black">Failed to load imports</p>
        <p className="text-xs text-brand-gray-mid">{error.message}</p>
      </div>
    </div>
  );
}
