import { Header } from "@/components/Header";
import { column } from "@/components/styles";
import { getCopy } from "@/i18n";

// Where the unsubscribe link in the newsletter lands. `functions/unsubscribe.ts` does the
// work and then sends the reader here, so these two pages are static and say only what
// happened — the token never reaches the browser's address bar and the site never holds
// the address it stood for.
//
// English-only, like the newsletter itself: neither path is in `PATH_LOCALES`
// (lib/i18n.ts), so there is no translated copy to link to.
const c = getCopy("en");

export function UnsubscribeResult({
  eyebrow,
  title,
  body,
  support = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  /** Offer the contact page. On the failure page only — there is nothing to ask
   *  about when it worked. */
  support?: boolean;
}) {
  return (
    <div className="min-h-screen">
      <Header c={c} locale="en" />
      <main className={column}>
        <section className="mx-auto mt-24 max-w-xl">
          <p className="font-mono text-xs font-semibold tracking-widest text-accent-deep">
            {eyebrow}
          </p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight">{title}</h1>
          <p className="mt-5 max-w-md leading-relaxed text-muted">{body}</p>
          {support && (
            <p className="mt-6 text-sm">
              <a
                href="/contact"
                className="text-ink underline underline-offset-4"
              >
                Contact support
              </a>
            </p>
          )}
          <a
            href="/"
            className="mt-10 inline-block text-sm font-semibold underline underline-offset-4"
          >
            Back to AI4Kanban
          </a>
        </section>
      </main>
    </div>
  );
}
