
export default function AnalyticsLoading() {
  const statCards = Array.from({ length: 3 });
  const chartCards = Array.from({ length: 3 });

  return (
    <div
      className="space-y-8 p-6"
      role="status"
      aria-label="Loading analytics"
    >
      {/* Screen-reader-only loading message */}
      <span className="sr-only">Loading analytics...</span>

      {/* Page heading */}
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Analytics summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((_, index) => (
          <div
            key={`stat-${index}`}
            className="rounded-lg border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
            </div>

            <div className="mt-4 h-8 w-20 animate-pulse rounded bg-muted" />

            <div className="mt-3 h-3 w-32 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Analytics charts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {chartCards.map((_, index) => (
          <div
            key={`chart-${index}`}
            className="rounded-lg border bg-card p-6 shadow-sm"
          >
            {/* Chart heading */}
            <div className="space-y-2">
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-48 animate-pulse rounded bg-muted" />
            </div>

            {/* Chart area */}
            <div className="mt-6 h-56 animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>

      {/* Analytics table / detailed data */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          <div className="h-3 w-56 animate-pulse rounded bg-muted" />
        </div>

        <div className="mt-6 space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`row-${index}`}
              className="flex items-center gap-4"
            >
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}