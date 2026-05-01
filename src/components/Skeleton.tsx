export function SkeletonCard() {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-zinc-800/50" />
      <div className="p-3.5 space-y-2.5">
        <div className="h-3.5 bg-zinc-800/60 rounded w-3/4" />
        <div className="h-3 bg-zinc-800/40 rounded w-1/2" />
        <div className="h-5 bg-zinc-800/60 rounded w-1/3" />
        <div className="h-1.5 bg-zinc-800/40 rounded w-full" />
        <div className="flex gap-2">
          <div className="flex-1 h-8 bg-zinc-800/40 rounded-lg" />
          <div className="flex-1 h-8 bg-zinc-800/40 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-16 bg-zinc-800/60 rounded" />
            <div className="h-3 w-28 bg-zinc-800/40 rounded" />
          </div>
          <div className="h-3.5 w-40 bg-zinc-800/50 rounded" />
        </div>
        <div className="h-5 w-16 bg-zinc-800/60 rounded" />
      </div>
    </div>
  );
}

export function SkeletonSaleCard() {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-12 bg-zinc-800/60 rounded" />
          <div className="h-4 w-16 bg-zinc-800/40 rounded" />
        </div>
        <div className="h-4 w-20 bg-zinc-800/50 rounded" />
      </div>
      <div className="h-5 w-3/4 bg-zinc-800/60 rounded mb-2" />
      <div className="h-3.5 w-full bg-zinc-800/40 rounded mb-3" />
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 bg-zinc-800/40 rounded" />
        <div className="h-3.5 w-20 bg-zinc-800/50 rounded" />
      </div>
    </div>
  );
}

export function SkeletonMetric() {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 animate-pulse">
      <div className="flex items-center justify-between mb-2">
        <div className="h-3 w-20 bg-zinc-800/60 rounded" />
        <div className="w-6 h-6 bg-zinc-800/60 rounded-md" />
      </div>
      <div className="h-6 w-24 bg-zinc-800/60 rounded" />
      <div className="h-2.5 w-16 bg-zinc-800/40 rounded mt-1.5" />
    </div>
  );
}
