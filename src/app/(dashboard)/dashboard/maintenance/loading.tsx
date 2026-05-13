export default function MaintenanceLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-4 w-72 rounded bg-muted" />
      </div>
      <div className="h-16 rounded-lg bg-muted" />
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="grid grid-cols-4 gap-4 border-b bg-muted/40 px-6 py-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-muted" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="grid grid-cols-4 gap-4 border-b px-6 py-4 last:border-0">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-4 rounded bg-muted" style={{ opacity: 1 - i * 0.1 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
