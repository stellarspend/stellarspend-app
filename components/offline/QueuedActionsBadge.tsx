interface QueuedActionsBadgeProps {
  count: number;
}

export default function QueuedActionsBadge({
  count,
}: QueuedActionsBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      aria-label="Queued offline actions"
      className="inline-flex min-w-7 items-center justify-center rounded-full border border-[#e8b84b]/30 bg-[#e8b84b]/15 px-2 py-1 text-[10px] font-black text-[#e8b84b]"
    >
      {count}
    </span>
  );
}