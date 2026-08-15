import type { Metadata } from "next";
import { Logo } from "@/components/ui/Logo";
import { getCopy } from "@/i18n";

// A render-only page: a single 1200×630 frame that IS the social share card,
// styled to match the landing hero. Open `/og-image/` at a 1200×630 viewport,
// screenshot it, and upload the PNG to the CDN path referenced by `OG_IMAGE`
// in lib/site.ts. Kept out of search — it's an asset source, not content.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const SHOTS = {
  board: "https://cdn.ai4kanban.dev/ai4kanban-ui-v5-board-view.jpg",
  card: "https://cdn.ai4kanban.dev/ai4kanban-ui-v5-card-view.jpg",
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
    // The captures are of the desktop app and carry their own window buttons,
    // so this frame draws no title bar of its own — one above them would read
    // as a window inside a window. Same call as the landing hero's deck.
    <div className="w-[548px] overflow-hidden rounded-xl border-2 border-border bg-code shadow-[8px_8px_0_0_var(--color-ink)]">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="block w-full" />
        {/* Pushes the back card into the deck by washing it toward the ground
            behind it — the ink here, not the page neutral. */}
        {dim && <span className="absolute inset-0 bg-ink/75" />}
      </div>
    </div>
  );
}

export default function OgImage() {
  return (
    // The card is the site's dark band, not a page: it is the one surface that
    // never appears next to the site — it is seen alone, in someone else's
    // timeline, at thumbnail size — and dark is what separates it there. So it
    // takes the footer's inversion exactly: the ink as the ground, the paper as
    // the type at full for the headline and 70% for the lead.
    //
    // What it is *not* is a field with two diffused accent glows, which is what
    // this card used to carry. That ground was a blurred coloured page, which is
    // the one thing the accent may not be. Inverting the ramp gets the dark
    // without it.
    <div className="relative flex h-[630px] w-[1200px] overflow-hidden bg-ink">
      {/* Left column: the logo, then the landing page's headline and lead. */}
      <div className="relative z-10 flex w-[640px] shrink-0 flex-col justify-center px-16 py-14">
        {/* The word inherits, so the lockup is its dark version by sitting
            here — paper on the ink, the same as it is in the footer. */}
        <div className="mb-9 text-elev">
          <Logo size="md" tone="ink" />
        </div>
        <h1 className="max-w-[540px] text-[58px] font-bold leading-[1.02] tracking-[-0.035em] text-elev">
          {c.hero.title}
        </h1>
        <p className="mt-7 max-w-[530px] text-[21px] leading-[1.42] text-elev/70">
          {c.hero.lead}
        </p>
        {/* The name takes the bright ember, not `accent-deep`: on the ink it is
            the readable one of the two, and the deep cut is nearly the ground.
            The TLD steps back to dimmed paper, so the string reads as the brand
            with a suffix rather than as nine characters of equal weight — the
            same move the footer makes with opacity instead of a second color. */}
        <div className="mt-10 font-mono text-[18px] font-semibold tracking-[0.08em] text-accent">
          ai4kanban<span className="text-elev/55">.dev</span>
        </div>
      </div>

      {/* Right column: the board and a card in the landing hero's flip-deck
          composition, with the board in front by default. */}
      <div className="absolute left-[636px] top-1/2 -translate-y-1/2">
        <div className="absolute left-13 top-13">
          <Frame src={SHOTS.card} alt={c.hero.shots.card.alt} dim />
        </div>
        <div className="relative">
          <Frame src={SHOTS.board} alt={c.hero.shots.board.alt} />
        </div>
      </div>
    </div>
  );
}
