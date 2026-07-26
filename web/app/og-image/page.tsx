import type { Metadata } from "next";

// A render-only page: a single 1200×630 frame that IS the social share card,
// styled to match the landing hero. Open `/og-image/` at a 1200×630 viewport,
// screenshot it, and upload the PNG to the CDN path referenced by `OG_IMAGE`
// in lib/site.ts. Kept out of search — it's an asset source, not content.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const SHOTS = {
  board: "https://cdn.ai4kanban.dev/kanban-skill-ui-v2.jpg",
  detail: "https://cdn.ai4kanban.dev/kanban-skill-ui-detail-v2.jpg",
};

// One browser-chromed screenshot. Both shots crop to the same body height so the
// two frames stack cleanly. `dim` darkens the back card so the front one pops.
function Frame({ src, dim = false }: { src: string; dim?: boolean }) {
  return (
    <div className="w-[528px] overflow-hidden rounded-lg border-2 border-border bg-code shadow-[8px_8px_0_0_#010409]">
      <div className="flex items-center gap-1.5 border-b-2 border-border px-3.5 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        <span className="ml-2 font-mono text-xs text-muted">localhost:7420</span>
      </div>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="block w-full" />
        {dim && <span className="absolute inset-0 bg-black/60" />}
      </div>
    </div>
  );
}

export default function OgImage() {
  return (
    <div className="relative flex h-[630px] w-[1200px] overflow-hidden bg-bg">
      {/* Accent glow bleeding in from the top-left, like the hero's mood. */}
      <div className="pointer-events-none absolute -left-40 -top-48 h-[520px] w-[520px] rounded-full bg-accent/20 blur-[130px]" />

      {/* Left column: the pitch. */}
      <div className="relative z-10 flex w-[640px] shrink-0 flex-col justify-center px-16">
        <span className="mb-6 inline-block w-fit rounded-full bg-accent/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          A Claude Code skill
        </span>
        <h1 className="text-[54px] font-bold leading-[1.05] tracking-tight text-ink">
          Your task board in Markdown, right next to your code.
        </h1>
        <p className="mt-6 text-[22px] leading-snug text-muted">
          Claude writes the cards and archives what&apos;s done. You steer in
          plain language. No database, no MCP.
        </p>
        <div className="mt-10 flex items-center gap-2.5 text-[26px] font-bold text-ink">
          <span aria-hidden="true">🗂️</span>
          <span>
            kanban <span className="font-normal text-muted">skill</span>
          </span>
        </div>
      </div>

      {/* Right column: the board view up front with a card-detail view peeking
          out behind it — the same flip-deck motif as the landing page. */}
      <div className="absolute left-[636px] top-1/2 -mt-7 -translate-y-1/2">
        <div className="absolute left-14 top-14">
          <Frame src={SHOTS.detail} dim />
        </div>
        <div className="relative">
          <Frame src={SHOTS.board} />
        </div>
      </div>
    </div>
  );
}
