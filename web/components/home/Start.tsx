import { FiDownload } from "react-icons/fi";
import { SectionTitle } from "./SectionTitle";
import { Rich } from "../Rich";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { panelInset } from "../styles";
import { localeHref, type Locale } from "@/lib/i18n";
import type { HomeCopy } from "@/i18n/home/types";

// Getting started (#177). The app leads and the terminal sits under it, which is
// the order a new reader actually does it in: a download needs nothing on the
// machine, and the command needs Node and a shell. The skill is not here at all
// — a board runs without one, so naming it on the way in is naming a step
// nobody has to take.
//
// One thing to press on the page, and it is the same thing the hero's button and
// the header's link point at. The setup prompt is a link under the command, not
// a second button: two buttons here is a reader choosing between two ways in
// before they know what either one is. The retired `npx ai4kanban-ui` way isn't
// named here or anywhere else on the site — see `pages/DownloadPage.tsx`.

// Not copy: a command is the same in every language (design.md §6). The `npx`
// form rather than a global install plus `akb`, because the page shows one
// command and never a list of shell steps.
const COMMAND = "npx ai4kanban@latest install";

export function Start({ c, locale }: { c: HomeCopy["start"]; locale: Locale }) {
  return (
    <section id="install" className="mt-28 scroll-mt-24">
      <SectionTitle num="05" title={c.title} />
      <p
        data-reveal
        data-delay="1"
        className="max-w-3xl text-[1.05rem] leading-relaxed text-muted"
      >
        {c.lead}
      </p>

      <div
        data-reveal
        data-delay="2"
        className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-4"
      >
        <Button href={localeHref(locale, "/download")} variant="primary">
          <FiDownload className="h-4 w-4" aria-hidden="true" />
          {c.cta}
        </Button>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {c.notes.map((note) => (
            <Chip key={note}>{note}</Chip>
          ))}
        </div>
      </div>

      {/* What a Mac user runs into on the very first open, beside the step it
          happens on rather than at the bottom of a page they have already left:
          the app is unsigned, so failing to open it is the first thing that
          happens to them. */}
      <p
        data-reveal
        data-delay="3"
        className="mt-5 max-w-3xl text-[0.9rem] leading-relaxed text-muted"
      >
        <Rich>{c.firstOpen}</Rich>
      </p>

      {/* The terminal way in, under the app. It is one command and a link — the
          list of shell steps this used to be is what the app replaced. */}
      <div data-reveal className="mt-16">
        <h3 className="text-lg font-bold">{c.terminal.title}</h3>
        <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-muted">
          <Rich>{c.terminal.body}</Rich>
        </p>
        <pre
          className={`${panelInset} mt-5 overflow-x-auto px-6 py-5 shadow-[8px_8px_0_0_var(--color-ink)]`}
        >
          <code className="font-mono text-sm leading-7 text-ink">{COMMAND}</code>
        </pre>
        <p className="mt-6 max-w-3xl text-[0.95rem] leading-relaxed text-muted">
          <Rich>{c.terminal.promptNote}</Rich>
        </p>
        <a
          href="/INSTALL_PROMPT.txt"
          className="mt-2 inline-block text-[0.95rem] font-semibold text-accent-deep no-underline hover:underline"
        >
          {c.terminal.promptLink} →
        </a>
      </div>
    </section>
  );
}
