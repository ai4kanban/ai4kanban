import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { column } from "@/components/styles";
import { getCopy } from "@/i18n";
import { getTemplatesCopy, type TemplatesLocale } from "@/i18n/templates";
import { jsonLd, pageUrl, webPage } from "@/lib/schema";
import { SHELL, TEMPLATES_PATH, templatePath, type Category, type Template } from "@/lib/templates";
import { Catalog } from "./Catalog";
import { Detail } from "./Detail";

// The template catalog (#1711): every published template by category, and a
// page for each. English and Chinese, like `/training`.

function Page({ locale, path, schema, children }: { locale: TemplatesLocale; path: string; schema?: string; children: ReactNode }) {
  const c = getCopy(locale);
  return (
    <>
      {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />}
      <Header c={c} locale={locale} />
      <main className={`${column} pb-16`}>{children}</main>
      <SiteFooter c={c} locale={locale} path={path} />
    </>
  );
}

export function TemplatesHomePage({ locale, initial }: { locale: TemplatesLocale; initial: Category[] | null }) {
  const t = getTemplatesCopy(locale);
  const page = webPage(TEMPLATES_PATH, t.meta.title, t.meta.description, { locale, type: "CollectionPage" });
  const items = (initial ?? []).flatMap((c) =>
    c.templates.map((tpl) => ({ url: pageUrl(templatePath(c.category, tpl.name), locale), name: tpl.title, description: tpl.summary })),
  );
  const schema = jsonLd(page, {
    "@type": "ItemList",
    "@id": `${pageUrl(TEMPLATES_PATH, locale)}#itemlist`,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, ...item })),
  });
  return (
    <Page locale={locale} path={TEMPLATES_PATH} schema={schema}>
      <Catalog locale={locale} initial={initial} />
    </Page>
  );
}

export function TemplateDetailPage({
  locale,
  category,
  name,
  initial,
}: {
  locale: TemplatesLocale;
  category: string;
  name: string;
  initial: Template | null;
}) {
  const t = getTemplatesCopy(locale);
  // The shell's real path is only known in the browser; its switcher offers the catalog.
  const path = name === SHELL ? TEMPLATES_PATH : templatePath(category, name);
  const schema = initial
    ? jsonLd(webPage(path, t.detailTitle(initial.title), initial.description, { locale }))
    : undefined;
  return (
    <Page locale={locale} path={path} schema={schema}>
      <Detail locale={locale} category={category} name={name} initial={initial} />
    </Page>
  );
}
