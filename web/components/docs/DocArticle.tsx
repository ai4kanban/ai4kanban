import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { BlogMdx } from "../blog/BlogMdx";
import { hairline } from "../styles";
import { Callout, Card, CardGroup, InstallBoard } from "./DocCards";
import { CopyPage } from "./CopyPage";
import { DocTocBlock, DocTocRail } from "./DocToc";
import { extractToc } from "@/lib/blog";
import { DOCS_PATH, docPath, getDocsNav, type DocPage } from "@/lib/docs";

// One documentation page: a compact head, the body, then previous / next. The
// route rail belongs to the layout; "On this page" is a rail right of the body
// from `xl` up and a folded block above it below that.
//
// `toc` is off for the landing page: it is a way into other pages, not a page
// read top to bottom.

type PagerItem = { label: string; href: string; group: string };

// Previous / next run through `_nav.json` in order, across groups.
function neighbours(href: string): [PagerItem?, PagerItem?] {
  const flat = getDocsNav(DOCS_PATH).flatMap((g) =>
    g.items.map((i) => ({ label: i.label, href: i.href, group: g.label })),
  );
  const at = flat.findIndex((i) => i.href === href);
  return at < 0 ? [] : [flat[at - 1], flat[at + 1]];
}

function PagerLink({ item, next }: { item: PagerItem; next?: boolean }) {
  return (
    <a
      href={item.href}
      className={`group flex flex-1 flex-col gap-0.5 rounded-lg border px-4 py-3 no-underline transition-colors hover:border-[color-mix(in_srgb,var(--color-ink)_22%,transparent)] ${hairline} ${
        next ? "items-end text-right" : ""
      }`}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {!next && <FiArrowLeft className="h-3 w-3" aria-hidden="true" />}
        {next ? "Next" : "Previous"}
        {next && <FiArrowRight className="h-3 w-3" aria-hidden="true" />}
      </span>
      <span className="font-medium text-ink transition-colors group-hover:text-accent-deep">
        {item.label}
      </span>
      <span className="text-xs text-muted">{item.group}</span>
    </a>
  );
}

function Pager({ prev, next }: { prev?: PagerItem; next?: PagerItem }) {
  if (!prev && !next) return null;
  const gap = <span className="hidden flex-1 sm:block" />;
  return (
    <nav
      aria-label="More documentation"
      className={`mt-12 flex flex-col gap-3 border-t pt-6 sm:flex-row ${hairline}`}
    >
      {prev ? <PagerLink item={prev} /> : gap}
      {next ? <PagerLink item={next} next /> : gap}
    </nav>
  );
}

export function DocArticle({
  doc,
  toc: showToc = true,
}: {
  doc: DocPage;
  toc?: boolean;
}) {
  const toc = showToc ? extractToc(doc.body) : [];
  const [prev, next] = neighbours(docPath(doc));

  return (
    <>
      <article
        className={`min-w-0 flex-1 ${showToc ? "max-w-[42rem]" : "max-w-[46rem]"}`}
      >
        <header>
          <p className="text-xs font-medium text-muted">{doc.group}</p>
          <h1 className="mt-1.5 text-[1.75rem] font-semibold leading-tight tracking-tight">
            {doc.title}
          </h1>
          <p className="mt-2 text-base leading-relaxed text-muted">{doc.lead}</p>
          <div className="mt-4 flex items-center gap-3 text-xs text-muted">
            <span>Updated {doc.lastUpdated}</span>
            <span aria-hidden="true">·</span>
            <CopyPage markdown={doc.body} />
          </div>
        </header>

        <DocTocBlock items={toc} />

        <div className="mt-8">
          <BlogMdx
            source={doc.body}
            className="docs-prose"
            extra={{ Callout, Card, CardGroup, InstallBoard }}
          />
        </div>

        <Pager prev={prev} next={next} />
      </article>
      <DocTocRail items={toc} />
    </>
  );
}
