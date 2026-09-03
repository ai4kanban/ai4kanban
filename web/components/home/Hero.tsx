import { Button } from "../ui/Button";
import { PlatformCta } from "../PlatformCta";
import { GITHUB_URL } from "../content";
import { HeroFlow } from "./HeroFlow";
import { Mat } from "./Mat";
import { heroTop } from "../styles";
import { localeHref, type Locale } from "@/lib/i18n";
import type { ResolvedSystem } from "../download/builds";
import type { HomeCopy } from "@/i18n/home/types";

// The hero reads top to bottom: the category, the promise, then the sequence
// that promise is made of. Side by side, the headline and the picture were each
// given half a row and neither got enough — the type wrapped after five words
// and the picture sat at a size where nothing in it could be read.
//
// The watercolour is the mat under the picture, not a banner behind the whole
// section: the wash was doing two jobs — ground for the type and ground for the
// artwork — and it is only good at the second. Text on pigment is the one thing
// a wash can't carry (design.md §Illustration).
export function Hero({
  c,
  locale,
  systems,
}: {
  c: HomeCopy["hero"];
  locale: Locale;
  systems: ResolvedSystem[];
}) {
  return (
    <section className={heroTop}>
      {/* Centred, because the block below it is centred: a full-column picture
          with left-ragged type over it hangs off one side. Capped well inside
          the column — a 64rem measure is a paragraph nobody finishes. */}
      <div className="mx-auto max-w-3xl text-center">
        {/* The category the product is in, said once, before the promise. It
            is prose in ember, so it takes the deep cut (design.md §Color). */}
        {/* The hero arrives on load rather than on scroll — it is already on
            screen, so there is nothing to wait for and nothing to observe.
            `Reveal.tsx` owns both halves of that rule; the lines come up in
            reading order. */}
        <p
          data-enter
          className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep"
        >
          {c.eyebrow}
        </p>
        {/* `text-balance` keeps the break off the middle of a word — Chinese and
            Japanese wrap anywhere, so an unbalanced line splits 规|划 down the
            middle. */}
        <h1
          data-enter
          data-delay="1"
          className="mt-5 text-balance text-[2.5rem] font-bold leading-[1.2] tracking-tight sm:text-5xl sm:leading-[1.15]"
        >
          {c.title}
        </h1>
        <p
          data-enter
          data-delay="2"
          className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted"
        >
          {c.lead}
        </p>
        <div
          data-enter
          data-delay="3"
          className="mt-9 flex flex-wrap justify-center gap-3"
        >
          {/* The download itself, not the setup section further down (#177).
              It is the same button section 03 and the download page carry, and
              it hands over the file for the system the reader is on — until the
              browser says which that is, it points at the download page. */}
          <PlatformCta
            systems={systems}
            label={c.ctaDownload}
            fallback={localeHref(locale, "/download")}
          />
          <Button href={GITHUB_URL}>{c.ctaGithub}</Button>
        </div>
      </div>

      {/* Same mount as every other picture on this page: a bare watercolour
          ground with the prints laid on it and no outline around any of them.
          It takes the ember pair, because the ember is the brand and this is
          where the brand is stated, and it is the one mat that breathes — six
          mats of weather down a page is six things moving beside the words. See
          `PixelWash.tsx` for the picture and `Wash.tsx` for why it is nowhere
          near the first paint. */}
      {/* The picture rises without fading, and that is not a preference: this is
          the page's largest block, and one held at `opacity: 0` isn't painted as
          far as the measurement is concerned. See `Reveal.tsx`. */}
      <Mat
        wash="emberLilac"
        animated
        data-enter="lift"
        data-delay="3"
        className="mt-14 p-4 sm:mt-16 sm:p-8 lg:p-10"
      >
        <HeroFlow c={c} />
      </Mat>
    </section>
  );
}
