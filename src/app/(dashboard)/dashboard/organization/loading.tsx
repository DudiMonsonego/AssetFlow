export default function OrgLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-44 rounded bg-muted" />
        <div className="h-4 w-64 rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-md bg-muted shrink-0" />
            <div className="space-y-1.5">
              <div className="h-3 w-16 rounded bg-muted" />
              <div className="h-6 w-10 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6 space-y-4">
            <div className="h-5 w-24 rounded bg-muted border-b pb-4" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-4 rounded bg-muted" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
