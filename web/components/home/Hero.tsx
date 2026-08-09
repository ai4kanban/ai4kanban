import Image from "next/image";
import { Button } from "../ui/Button";
import { GITHUB_URL } from "../content";
import { HeroShots } from "./HeroShots";
import { CDN } from "@/lib/site";
import { heroTop } from "../styles";
import type { HomeCopy } from "@/i18n/home/types";

// The watercolour banner behind the hero — the same paper and the same azure as
// the mats in `Loop.tsx`, so the page opens in the palette it goes on to use.
const BANNER = `${CDN}/bg-hero-v1.webp`;

export function Hero({ c }: { c: HomeCopy["hero"] }) {
  return (
    <section
      className={`relative ${heroTop} grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12`}
    >
      {/* The banner breaks out of the page's `max-w-5xl` column to the full
          viewport (`left-1/2 w-screen -translate-x-1/2`) and is pulled back up
          over the section's top margin so the pigment starts at the header's
          rule. Those two offsets are `heroTop` restated — the negative top and
          the extra height both have to equal it at both breakpoints, or the
          wash starts below the rule and draws an edge across the page. The mask
          dissolves it into the page ground, so the image never ends on a
          visible edge.

          It is a `next/image` and not a CSS `background-image` for one reason:
          `priority` puts a `<link rel=preload>` in the head, so the browser
          starts the fetch from the HTML instead of waiting until it has parsed
          the stylesheet and laid the section out. The export is static
          (`images.unoptimized`), so Next does no resizing here — the file is
          pre-encoded WebP and served `immutable` from the CDN.

          `fetchPriority` is set by hand because this is the LCP element: it
          covers the viewport, so it is larger than the screenshot deck beside
          it, and `priority` alone only preloads at the default priority. The
          deck in `HeroShots.tsx` asks for `high` too — they are two files on
          one HTTP/2 connection, and both are hero content.

          It is off below `sm`. A phone viewport is narrower than the wash's
          soft middle, so what lands there is a crop of one corner — texture
          behind the headline rather than the banner the section was drawn
          around, and it reads as noise. The section keeps the plain page
          ground there, and the headline is the LCP element instead. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 -z-10 hidden h-[calc(100%+5rem)] w-screen -translate-x-1/2 overflow-hidden opacity-60 [mask-image:linear-gradient(to_bottom,#000_35%,transparent_92%)] sm:block lg:-top-32 lg:h-[calc(100%+8rem)]"
      >
        <Image
          src={BANNER}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-top"
        />
      </div>

      <div>
        {/* `text-balance` keeps the break off the middle of a word — Chinese and
            Japanese wrap anywhere, so an unbalanced line splits 规|划 down the
            middle. */}
        <h1 className="text-balance text-[2.5rem] font-bold leading-[1.2] tracking-tight sm:text-5xl sm:leading-[1.15]">
          {c.title}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted">{c.lead}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button href="#install" variant="primary">
            {c.ctaInstall}
          </Button>
          <Button href={GITHUB_URL}>{c.ctaGithub}</Button>
        </div>
      </div>

      <HeroShots c={c.shots} />
    </section>
  );
}
