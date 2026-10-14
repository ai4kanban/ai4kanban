import { Button } from "../ui/Button";
import { PlatformCta } from "../PlatformCta";
import { GITHUB_URL } from "../content";
import { HeroVideo } from "./HeroVideo";
import { Mat, printFrame } from "./Mat";
import { heroTop } from "../styles";
import { localeHref, type Locale } from "@/lib/i18n";
import type { ResolvedSystem } from "../download/builds";
import type { HomeCopy } from "@/i18n/home/types";

// The sentence, then the /demo recording on the hero's mat. The words arrive on load
// (`Reveal.tsx`); the mat rises without fading, because it is the page's LCP element.
export function Hero({
  c,
  locale,
  systems,
  version,
}: {
  c: HomeCopy["hero"];
  locale: Locale;
  systems: ResolvedSystem[];
  /** The release the button hands over, counted with the press (#297). */
  version: string;
}) {
  return (
    <section className={heroTop}>
      <div className="mx-auto max-w-3xl text-center">
        {/* `text-balance` keeps Chinese and Japanese from breaking mid-word. An English title
            breaks after each sentence. */}
        <h1
          data-enter
          className="text-balance text-[2.5rem] font-bold leading-[1.2] tracking-tight sm:text-5xl sm:leading-[1.15]"
        >
          {c.title.split(/(?<=\.) /).map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p
          data-enter
          data-delay="1"
          className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted"
        >
          {c.lead}
        </p>
        <div data-enter data-delay="2" className="mt-9 flex flex-wrap justify-center gap-3">
          <PlatformCta
            systems={systems}
            version={version}
            label={c.ctaDownload}
            fallback={localeHref(locale, "/download")}
            place="hero"
          />
          <Button href={GITHUB_URL}>{c.ctaGithub}</Button>
        </div>
      </div>

      <Mat
        wash="emberLilac"
        animated
        data-enter="lift"
        data-delay="3"
        className="mt-14 p-4 sm:mt-16 sm:p-8 lg:p-10"
      >
        <div className={printFrame}>
          <HeroVideo label={c.image} />
        </div>
      </Mat>
    </section>
  );
}
