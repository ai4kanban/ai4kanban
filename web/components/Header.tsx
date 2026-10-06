"use client";

import { useEffect, useState, type ComponentType } from "react";
import { FaGithub } from "react-icons/fa";
import {
  FiArrowRight,
  FiBookOpen,
  FiCompass,
  FiDownload,
} from "react-icons/fi";
import { Button } from "./ui/Button";
import { Logo } from "./ui/Logo";
import { GITHUB_URL } from "./content";
import { Dropdown } from "./Dropdown";
import { MobileNav } from "./MobileNav";
import { hairline } from "./styles";
import { localeHref, localePath, publishedIn, type Locale } from "@/lib/i18n";
import type { SiteCopy } from "@/i18n/types";

// A few pixels rather than 0, so a browser restoring a scroll position of 1px
// doesn't open the page with a rule on it.
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return scrolled;
}

// The chrome on top of every page.
export function Header({
  c,
  locale,
  overlay = false,
}: {
  c: SiteCopy;
  locale: Locale;
  /** For a page that opens on artwork (`blog/Backdrop.tsx`): no fill until the
   *  page moves, so the plate runs behind the row. */
  overlay?: boolean;
}) {
  const nav = c.shared.nav;
  const scrolled = useScrolled();
  // Training and pricing are English and Chinese only; elsewhere the links are
  // not drawn at all.
  const training = publishedIn("/training", locale);
  const pricing = publishedIn("/pricing", locale);

  return (
    // Sticky, so the menus get a z-index over the page. The rule is transparent
    // rather than absent at the top so the row doesn't jump when it appears.
    <header
      className={`sticky top-0 z-30 border-b transition-colors duration-150 ${
        scrolled
          ? `${hairline} bg-elev/85 backdrop-blur-md`
          : `border-transparent ${overlay ? "bg-transparent" : "bg-elev/85 backdrop-blur-md"}`
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-3">
        <a href={localePath(locale, "")} className="text-ink no-underline">
          <Logo size="sm" />
        </a>

        {/* Phone: the two actions stay out in the row, everything else is
            behind the menu. The swap is at `lg`: French labels overflow `md`. */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <GitHubButton label={c.shared.footer.github} />
          <Button
            href={localeHref(locale, "/download")}
            variant="ink"
            size="icon"
            aria-label={nav.download}
          >
            <FiDownload className="h-4 w-4" aria-hidden="true" />
          </Button>
          <MobileNav c={c} locale={locale} />
        </div>

        <nav className="hidden items-center text-[0.95rem] text-muted lg:flex lg:gap-x-4 xl:gap-x-6">
          {/* The docs and the blog are English-only, so they never take a
              locale prefix. */}
          <a href="/docs" className="transition-colors hover:text-ink">
            {nav.docs}
          </a>
          {pricing && (
            <a
              href={localeHref(locale, "/pricing")}
              className="transition-colors hover:text-ink"
            >
              {nav.pricing}
            </a>
          )}
          <Dropdown
            label={nav.resources}
            hover
            width="w-[340px]"
            summaryClass="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-ink group-open:text-ink"
            panelClass={`menu-in relative mt-1 rounded-xl border bg-elev p-1.5 shadow-[0_16px_40px_-16px_rgba(36,35,31,0.3)] ${hairline}`}
          >
            <span
              aria-hidden="true"
              className={`absolute -top-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-tl-[3px] border-l border-t bg-elev ${hairline}`}
            />
            <ResourceLink
              href="/blog"
              title={nav.blog}
              note={nav.blogNote}
              Icon={FiBookOpen}
              tint="bg-accent/10 text-accent-deep"
            />
            {training && (
              <ResourceLink
                href={localeHref(locale, "/training")}
                title={nav.training}
                note={nav.trainingNote}
                Icon={FiCompass}
                tint="bg-growth/10 text-growth"
              />
            )}
          </Dropdown>
          {/* The one place to get the product, and its source beside it. */}
          <div className="flex items-center gap-2.5">
            <GitHubButton label={c.shared.footer.github} />
            <Button
              href={localeHref(locale, "/download")}
              variant="ink"
              size="sm"
            >
              <FiDownload className="h-4 w-4" aria-hidden="true" />
              {nav.download}
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}

// The footer's plain "GitHub" is the name: the nav string carries a ↗ that a
// screen reader reads out as an arrow.
function GitHubButton({ label }: { label: string }) {
  return (
    <Button href={GITHUB_URL} size="icon" aria-label={label}>
      <FaGithub className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

function ResourceLink({
  href,
  title,
  note,
  Icon,
  tint,
}: {
  href: string;
  title: string;
  note: string;
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tint: string;
}) {
  return (
    <a
      href={href}
      className="group/item flex items-center gap-3 rounded-lg p-2.5 no-underline transition-colors duration-200 hover:bg-band focus-visible:bg-band"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 ease-out group-hover/item:scale-105 motion-reduce:transition-none motion-reduce:group-hover/item:scale-100 ${tint}`}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-[0.8rem] leading-snug text-muted">
          {note}
        </span>
      </span>
      <FiArrowRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 -translate-x-1 text-ink opacity-0 transition-all duration-200 ease-out group-hover/item:translate-x-0 group-hover/item:opacity-100 group-focus-visible/item:translate-x-0 group-focus-visible/item:opacity-100 motion-reduce:translate-x-0"
      />
    </a>
  );
}
