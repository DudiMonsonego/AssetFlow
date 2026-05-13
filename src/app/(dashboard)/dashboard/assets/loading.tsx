/**
 * Streaming loading UI for /dashboard/assets.
 * Shown instantly by Next.js while the server pre-fetches asset data.
 */
export default function AssetsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-32 rounded bg-muted" />
          <div className="h-4 w-56 rounded bg-muted" />
        </div>
        <div className="h-9 w-32 rounded bg-muted" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-5 gap-4 border-b bg-muted/40 px-6 py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-muted" />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-5 gap-4 border-b px-6 py-4 last:border-0"
          >
            {Array.from({ length: 5 }).map((_, j) => (
              <div
                key={j}
                className="h-4 rounded bg-muted"
                style={{ opacity: 1 - i * 0.1 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
