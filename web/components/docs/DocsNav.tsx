"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { GITHUB_URL } from "../content";
import { panelBareInset } from "../styles";
import { docIcon } from "./doc-icons";
import type { DocNavGroup } from "@/lib/docs";

// The section's route rail: every documentation page, under the headings
// `web/docs/_nav.json` puts them in. Rendered once by the docs layout, so it
// keeps its scroll position as the reader moves between pages.
//
// From `lg` up it is a sticky column beside the body. Below that there is no
// room for a second column, so it folds into a disclosure above the page — the
// same block, and the same open/close, as "On this page" (`BlogToc.tsx`).
//
// The page you are on is marked by a step on the neutral ramp — the wash, plus
// the weight — and not by an ember tint. The rail is chrome, and the ember is
// reserved for the things a page is actually pointing at.

const LABEL =
  "font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted";

function NavGroups({
  groups,
  pathname,
  onNavigate,
}: {
  groups: DocNavGroup[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-7">
      {groups.map((group) => (
        <div key={group.label}>
          <p className={`${LABEL} mb-2 px-3`}>{group.label}</p>
          <ul className="flex list-none flex-col gap-0.5">
            {group.items.map((item) => {
              const current = pathname === item.href;
              const Icon = docIcon(item.icon);
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={current ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm leading-snug no-underline transition-colors ${
                      current
                        ? "bg-code font-semibold text-ink"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    <Icon
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

// The one link out of the rail. A panel here would be a second raised object on
// a page that already has one, so it is a line of text on the page ground.
function AskLink() {
  return (
    <p className="mt-8 px-3 text-sm leading-relaxed text-muted">
      Something missing?
      <br />
      <a
        href={`${GITHUB_URL}/issues`}
        rel="noopener"
        className="text-accent-deep no-underline transition-colors hover:text-ink"
      >
        Open an issue ↗
      </a>
    </p>
  );
}

export function DocsNav({ groups }: { groups: DocNavGroup[] }) {
  const pathname = usePathname();
  const details = useRef<HTMLDetailsElement>(null);

  return (
    <>
      <nav
        aria-label="Documentation"
        className="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-8rem)] lg:w-52 lg:shrink-0 lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:pb-8"
      >
        <NavGroups groups={groups} pathname={pathname} />
        <AskLink />
      </nav>

      {/* Bare wash, where "On this page" below it is raised: the rail is chrome
          and the table of contents is about the page in front of you, and two
          shadowed blocks stacked on a phone is two objects where there is one. */}
      <details
        ref={details}
        className={`${panelBareInset} group px-5 py-4 lg:hidden`}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <span className={LABEL}>Documentation</span>
          <span
            aria-hidden="true"
            className="text-lg leading-none text-accent-deep transition-transform duration-200 group-open:rotate-45"
          >
            +
          </span>
        </summary>
        <div className="mt-4">
          <NavGroups
            groups={groups}
            pathname={pathname}
            onNavigate={() => {
              if (details.current) details.current.open = false;
            }}
          />
        </div>
      </details>
    </>
  );
}
