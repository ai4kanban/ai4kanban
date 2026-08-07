// The real Vibe Kanban mark, pulled from vibekanban.com, used wherever we'd
// otherwise reach for a generic 🎛️ to stand in for Vibe Kanban.
export function VibeKanbanMark({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/vibe-kanban-logo.png"
      alt="Vibe Kanban"
      width={20}
      height={20}
      className={`inline-block shrink-0 ${className}`}
    />
  );
}
