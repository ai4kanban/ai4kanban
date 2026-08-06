import type { Metadata } from "next";
import { getCopy } from "@/i18n";

// A render-only page: a single 1200×630 frame that IS the social share card,
// styled to match the landing hero. Open `/og-image/` at a 1200×630 viewport,
// screenshot it, and upload the PNG to the CDN path referenced by `OG_IMAGE`
// in lib/site.ts. Kept out of search — it's an asset source, not content.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const SHOTS = {
  board: "https://cdn.ai4kanban.dev/ai4kanban-ui-v4-board-view.jpg",
  queue: "https://cdn.ai4kanban.dev/ai4kanban-ui-v4-queue-view.jpg",
};

const c = getCopy("en").home;

// One browser-chromed screenshot. `dim` pushes the back card into the deck so
// the Board view stays dominant, matching the landing hero's default state.
function Frame({
  src,
  alt,
  dim = false,
}: {
  src: string;
  alt: string;
  dim?: boolean;
}) {
  return (
    <div className="w-[548px] overflow-hidden rounded-xl border-2 border-border bg-code shadow-[8px_8px_0_0_var(--color-ink)]">
      <div className="flex h-7 items-center gap-1.5 border-b-2 border-border bg-elev px-3.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
      </div>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="block w-full" />
        {dim && <span className="absolute inset-0 bg-bg/75" />}
      </div>
    </div>
  );
}

export default function OgImage() {
  return (
    // The ground is the landing page's ground and nothing else. Two diffused
    // accent glows used to sit behind the pitch and the deck; a blurred blue
    // field is the one thing the azure may not be — a page — and it made the
    // card the only surface on the site with a colored background.
    <div className="relative flex h-[630px] w-[1200px] overflow-hidden bg-bg">
      {/* Left column: the landing page's current brand, headline and lead. */}
      <div className="relative z-10 flex w-[640px] shrink-0 flex-col justify-center px-16 py-14">
        <div className="mb-9 flex items-center gap-3 text-[24px] font-bold text-ink">
          <span>{c.header.brand}</span>
        </div>
        <h1 className="max-w-[540px] text-[58px] font-bold leading-[1.02] tracking-[-0.035em] text-ink">
          {c.hero.title}
        </h1>
        <p className="mt-7 max-w-[530px] text-[21px] leading-[1.42] text-muted">
          {c.hero.lead}
        </p>
        <div className="mt-10 font-mono text-[18px] font-semibold tracking-[0.08em] text-accent-deep">
          ai4kanban.dev
        </div>
      </div>

      {/* Right column: the new Board and Queue views in the landing hero's
          flip-deck composition, with Board in front by default. */}
      <div className="absolute left-[636px] top-1/2 -translate-y-1/2">
        <div className="absolute left-13 top-13">
          <Frame src={SHOTS.queue} alt={c.hero.shots.queue.alt} dim />
        </div>
        <div className="relative">
          <Frame src={SHOTS.board} alt={c.hero.shots.board.alt} />
        </div>
      </div>
    </div>
  );
}
