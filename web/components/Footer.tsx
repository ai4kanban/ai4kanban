import { GITHUB_URL } from "./content";
import { LanguageSwitcher } from "./LanguageSwitcher";
import type { SiteCopy } from "@/i18n/types";
import type { Locale } from "@/lib/i18n";

export function Footer({
  c,
  locale,
  path,
}: {
  c: SiteCopy;
  locale: Locale;
  /** The route being viewed — what the language switcher jumps between. */
  path: string;
}) {
  return (
    <footer className="mx-auto mt-20 max-w-4xl border-t-2 border-border px-6 pb-12 pt-8 text-center text-sm text-muted">
      <p>
        <a href={GITHUB_URL} rel="noopener" className="text-muted hover:text-ink">
          GitHub
        </a>{" "}
        · {c.shared.footer.license} · {c.shared.footer.origin}{" "}
        <a href="https://www.dist0.com/" rel="noopener" className="text-muted hover:text-ink">
          dist0
        </a>
      </p>
      <LanguageSwitcher
        locale={locale}
        path={path}
        label={c.shared.language.label}
      />
    </footer>
  );
}
