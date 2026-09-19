import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { DocsNav } from "@/components/docs/DocsNav";
import { getCopy } from "@/i18n";
import { DOCS_PATH, getDocsNav } from "@/lib/docs";
import "../../blog-prose.css";

// The shell every documentation page shares. The route rail lives here rather
// than on the page so it keeps its scroll position as the reader moves between
// pages — a layout is not re-mounted by a navigation inside it.
//
// The columns sit in the site's own content width, the header's `max-w-6xl`:
// the route rail, the body, and from `xl` up the page's own contents rail.
//
// The docs are English-only — see `TRANSLATED_PATHS` in lib/i18n.ts. The footer
// is given the section's base path, which is enough for it: the language
// switcher hides itself on any route that has no other language.
const c = getCopy("en");

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header c={c} locale="en" />
      <main className="mx-auto mt-4 max-w-6xl px-6 pb-8 lg:mt-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
          <DocsNav groups={getDocsNav(DOCS_PATH)} />
          {children}
        </div>
      </main>
      <SiteFooter c={c} locale="en" path={DOCS_PATH} />
    </>
  );
}
