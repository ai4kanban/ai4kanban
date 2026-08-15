import { Button } from "../ui/Button";
import { GITHUB_URL } from "../content";
import { HeroShots } from "./HeroShots";
import { Mat } from "./Mat";
import { heroTop } from "../styles";
import { localeHref, type Locale } from "@/lib/i18n";
import type { HomeCopy } from "@/i18n/home/types";

// The hero reads top to bottom: the sentence, then the thing it is about. Side
// by side, the headline and the screenshot deck were each given half a row and
// neither got enough — the type wrapped after five words and the deck sat at a
// size where you could see it was a board but not read one. Stacked, the
// headline gets a measure it can breathe in and the deck gets the full column.
//
// The watercolour used to be a full-bleed banner behind the whole section, with
// the header's rule as its top edge. It is the mat under the deck instead: the
// wash was doing two jobs — ground for the type and ground for the screenshots —
// and it is only good at the second. Text on pigment is the one thing the wash
// can't carry (design.md §2), and pulling it under the deck means the header
// has nothing to sit on and can vanish into the page until you scroll.
export function Hero({ c, locale }: { c: HomeCopy["hero"]; locale: Locale }) {
  return (
    <section className={heroTop}>
      {/* Centred, because the block below it is centred: a full-column image
          with left-ragged type over it hangs off one side. Capped well inside
          the column — a 64rem measure is a paragraph nobody finishes. */}
      <div className="mx-auto max-w-3xl text-center">
        {/* `text-balance` keeps the break off the middle of a word — Chinese and
            Japanese wrap anywhere, so an unbalanced line splits 规|划 down the
            middle. */}
        {/* The hero arrives on load rather than on scroll — it is already on
            screen, so there is nothing to wait for and nothing to observe.
            `Reveal.tsx` owns both halves of that rule; the sentence, its lead
            and the buttons come up in reading order. */}
        <h1
          data-enter
          className="text-balance text-[2.5rem] font-bold leading-[1.2] tracking-tight sm:text-5xl sm:leading-[1.15]"
        >
          {c.title}
        </h1>
        <p
          data-enter
          data-delay="1"
          className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted"
        >
          {c.lead}
        </p>
        <div
          data-enter
          data-delay="2"
          className="mt-9 flex flex-wrap justify-center gap-3"
        >
          {/* The download, not the setup section further down (#177): the app is
              the way in now, and the one button at the top of the page has to be
              the same thing the header's link and the getting-started section
              lead with. */}
          <Button href={localeHref(locale, "/download")} variant="primary">
            {c.ctaDownload}
          </Button>
          <Button href={GITHUB_URL}>{c.ctaGithub}</Button>
        </div>
      </div>

      {/* Same mount as every other picture on this page: a bare watercolour
          ground, the print laid on it with a soft shadow, and no outline around
          either. It takes the ember pair, because the ember is the brand and
          this is where the brand is stated, and it is the one mat that breathes
          — six mats of weather down a page is six things moving beside the
          words. See `PixelWash.tsx` for the picture and `Wash.tsx` for why it
          is nowhere near the first paint.

          The margin of paint is wider than `Loop.tsx`'s, because the print is:
          a border reads as a proportion of what it surrounds, and the 24px that
          frames a 464px drawing is a hairline around a print three times that
          wide. */}
      {/* The deck rises without fading, and that is not a preference: this is
          the page's LCP element, and a block held at `opacity: 0` isn't painted
          as far as the measurement is concerned. See `Reveal.tsx`. */}
      <Mat
        wash="emberLilac"
        animated
        data-enter="lift"
        data-delay="3"
        className="mt-14 p-4 sm:mt-16 sm:p-8 lg:p-10"
      >
        <HeroShots c={c.shots} />
      </Mat>
    </section>
  );
}
