// What both languages' `/templates/<category>/<name>` routes share.
import type { Metadata } from "next";
import { getTemplatesCopy, type TemplatesLocale } from "@/i18n/templates";
import { pageMetadata } from "./metadata";
import { SHELL, buildCatalog, buildTemplate, templatePath } from "./templates";

/** Every template the build can see, plus the shell any later one is drawn from. */
export async function templateParams(): Promise<{ category: string; name: string }[]> {
  const seen = (await buildCatalog()) ?? [];
  return [
    ...seen.flatMap((c) => c.templates.map((t) => ({ category: c.category, name: t.name }))),
    { category: SHELL, name: SHELL },
  ];
}

export async function templateMetadata(locale: TemplatesLocale, category: string, name: string): Promise<Metadata> {
  const t = getTemplatesCopy(locale);
  const tpl = await buildTemplate(name);
  // The shell, or a template gone by build time: never a page to index.
  if (!tpl) return { title: t.meta.title, robots: { index: false } };
  return pageMetadata({
    locale,
    path: templatePath(category, name),
    title: t.detailTitle(tpl.title),
    description: tpl.summary,
  });
}
