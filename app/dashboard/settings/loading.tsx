export default function SettingsLoading() {
  return (
    <div className="relative min-h-screen w-full bg-[#080b18] p-6 lg:p-12">
      <div className="relative z-10 max-w-4xl mx-auto space-y-12">
        <div className="space-y-4">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-10 w-64 animate-pulse rounded bg-muted" />
          <div className="h-5 w-full max-w-xl animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
