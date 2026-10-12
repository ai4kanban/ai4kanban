// The draft-first logo: the mark (public/draft-first/mark.svg) and the name in the page's
// own face. public/draft-first/logo.svg is the same lockup outlined, for READMEs.
export function Lockup({ size = 24 }: { size?: number }) {
  return (
    <span className="inline-flex items-center" style={{ gap: size * 0.3 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- an SVG mark */}
      <img src="/draft-first/mark.svg" alt="" width={size * 1.6} height={size * 1.6} />
      <span className="font-bold tracking-[-0.02em]" style={{ fontSize: size * 0.82 }}>
        draft-first
      </span>
    </span>
  );
}
