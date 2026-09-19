"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { FiChevronDown } from "react-icons/fi";
import { GITHUB_URL } from "../content";
import { hairline } from "../styles";
import { docIcon } from "./doc-icons";
import type { DocNavGroup } from "@/lib/docs";

// The section's route rail: every documentation page, under the headings
// `web/content/docs/_nav.json` puts them in. Rendered once by the docs layout, so it
// keeps its scroll position as the reader moves between pages.
//
// From `lg` up it is a sticky column beside the body. Below that it folds into
// one row that says where you are and opens to the same groups. Labels, icons
// and the footer share one left edge; rows bleed 8px into the gutter so a tint
// frames the row without moving its text.

const LABEL = "text-xs font-medium text-muted";

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
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className={`${LABEL} mb-1`}>{group.label}</p>
          <ul className="flex list-none flex-col gap-px">
            {group.items.map((item) => {
              const current = pathname === item.href;
              const Icon = docIcon(item.icon);
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={current ? "page" : undefined}
                    className={`-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm leading-snug no-underline transition-colors ${
                      current
                        ? "bg-accent/[0.07] font-medium text-accent-deep"
                        : "text-ink/75 hover:bg-ink/[0.04] hover:text-ink"
                    }`}
                  >
                    <Icon
                      className="h-3.5 w-3.5 shrink-0 opacity-70"
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

function AskLink() {
  return (
    <p className="mt-8 text-xs leading-relaxed text-muted">
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
  const group = groups.find((g) => g.items.some((i) => i.href === pathname));
  const page = group?.items.find((i) => i.href === pathname);

  return (
    <>
      <nav
        aria-label="Documentation"
        className="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-8rem)] lg:w-52 lg:shrink-0 lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:px-2 lg:pb-8"
      >
        <NavGroups groups={groups} pathname={pathname} />
        <AskLink />
      </nav>

      <details
        ref={details}
        className={`group border-y py-2.5 lg:hidden ${hairline}`}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm">
            {page ? (
              <>
                <span className="shrink-0 text-muted">{group?.label}</span>
                <span className="text-muted" aria-hidden="true">/</span>
                <span className="truncate text-ink">{page.label}</span>
              </>
            ) : (
              <span className="text-muted">Documentation</span>
            )}
          </span>
          <FiChevronDown
            className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="mt-3 pb-1">
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
