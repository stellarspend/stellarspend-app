export default function AnalyticsLoading() {
    return (
      <div className="space-y-8 p-6">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-72 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }
