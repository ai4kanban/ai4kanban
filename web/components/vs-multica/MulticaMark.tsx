// The real Multica mark, pulled from multica.ai, used wherever we'd otherwise
// reach for a generic ⚡ to stand in for Multica.
export function MulticaMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/multica-logo.svg"
      alt="Multica"
      width={24}
      height={24}
      className={`inline-block shrink-0 ${className}`}
    />
  );
}
