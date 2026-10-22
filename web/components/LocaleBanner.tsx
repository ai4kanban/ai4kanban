import { FiGlobe, FiX } from "react-icons/fi";
import shared from "@/i18n/shared";
import { LOCALE_TAGS, localePath, localesFor, type Locale } from "@/lib/i18n";

// The bar above the header offering the page in the reader's language, written
// in that language. One is drawn per language the page has, all hidden; the
// inline script in the root layouts picks which one shows before first paint
// (`lib/locale-suggest.ts`), so nothing here runs in the browser.
export function LocaleBanners({ locale, path }: { locale: Locale; path: string }) {
  return localesFor(path)
    .filter((l) => l !== locale)
    .map((l) => <LocaleBanner key={l} to={l} from={locale} path={path} />);
}

function LocaleBanner({ to, from, path }: { to: Locale; from: Locale; path: string }) {
  const t = shared[to].language;
  return (
    <div
      data-locale-banner={to}
      lang={LOCALE_TAGS[to]}
      className="border-b border-ink/10 bg-band text-sm text-ink"
    >
      <div className="relative mx-auto flex max-w-6xl items-center gap-3 px-6 py-2 sm:justify-center sm:px-14">
        <FiGlobe className="hidden h-4 w-4 shrink-0 text-muted sm:block" aria-hidden="true" />
        <p className="min-w-0 flex-1 sm:flex-none">
          <span className="sm:hidden">{t.offerShort}</span>
          <span className="hidden sm:inline">{t.offer}</span>
        </p>
        <a
          href={localePath(to, path)}
          hrefLang={LOCALE_TAGS[to]}
          data-locale-choice={to}
          className="shrink-0 font-semibold text-accent-deep underline decoration-accent-deep/30 underline-offset-4 hover:decoration-accent-deep"
        >
          {t.switchTo}
        </a>
        <button
          type="button"
          aria-label={t.dismiss}
          title={t.dismiss}
          data-locale-choice={from}
          className="-mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-ink/5 hover:text-ink sm:absolute sm:right-6 sm:mr-0"
        >
          <FiX className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
