// The real Task Master mark, taken from the project's own favicon, used
// wherever we'd otherwise reach for a generic glyph to stand in for it.
export function TmMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/task-master-logo.svg"
      alt="Task Master"
      width={24}
      height={24}
      className={`inline-block shrink-0 ${className}`}
    />
  );
}
