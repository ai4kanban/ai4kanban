import { Button } from "../ui/Button";
import { GITHUB_URL } from "../content";
import { HeroShots } from "./HeroShots";
import { HeroWash } from "./HeroWash";
import { Mat } from "./Mat";
import { heroTop } from "../styles";
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
export function Hero({ c }: { c: HomeCopy["hero"] }) {
  return (
    <section className={heroTop}>
      {/* Centred, because the block below it is centred: a full-column image
          with left-ragged type over it hangs off one side. Capped well inside
          the column — a 64rem measure is a paragraph nobody finishes. */}
      <div className="mx-auto max-w-3xl text-center">
        {/* `text-balance` keeps the break off the middle of a word — Chinese and
            Japanese wrap anywhere, so an unbalanced line splits 规|划 down the
            middle. */}
        <h1 className="text-balance text-[2.5rem] font-bold leading-[1.2] tracking-tight sm:text-5xl sm:leading-[1.15]">
          {c.title}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted">
          {c.lead}
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button href="#install" variant="primary">
            {c.ctaInstall}
          </Button>
          <Button href={GITHUB_URL}>{c.ctaGithub}</Button>
        </div>
      </div>

      {/* Same mount as every other picture on this page: a bare watercolour
          ground, the print laid on it with a soft shadow, and no outline around
          either. The three mats below carry a painting from the CDN; this one
          is painted in the page — a wash off the top-right corner and one off
          the bottom-left, the page's own white between them, drawn as pixels
          and breathing. See `PixelWash.tsx` for the picture and `HeroWash.tsx`
          for why it is nowhere near the first paint.

          The margin of paint is wider than `Loop.tsx`'s, because the print is:
          a border reads as a proportion of what it surrounds, and the 24px that
          frames a 464px drawing is a hairline around a print three times that
          wide. */}
      <Mat paint={<HeroWash />} className="mt-14 p-4 sm:mt-16 sm:p-8 lg:p-10">
        <HeroShots c={c.shots} />
      </Mat>
    </section>
  );
}
