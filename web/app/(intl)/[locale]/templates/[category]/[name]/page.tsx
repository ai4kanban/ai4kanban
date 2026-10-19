import { notFound } from "next/navigation";
import { TemplateDetailPage } from "@/components/templates/TemplatesPage";
import { TEMPLATES_LOCALES, isTemplatesLocale } from "@/i18n/templates";
import { templateMetadata, templateParams } from "@/lib/template-route";
import { buildTemplate } from "@/lib/templates";

// One template's page in Chinese, at /zh/templates/<category>/<name>.

type Props = { params: Promise<{ locale: string; category: string; name: string }> };

export async function generateStaticParams() {
  const params = await templateParams();
  return TEMPLATES_LOCALES.filter((l) => l !== "en").flatMap((locale) => params.map((p) => ({ locale, ...p })));
}

export async function generateMetadata({ params }: Props) {
  const { locale, category, name } = await params;
  if (!isTemplatesLocale(locale) || locale === "en") notFound();
  return templateMetadata(locale, category, name);
}

export default async function Page({ params }: Props) {
  const { locale, category, name } = await params;
  if (!isTemplatesLocale(locale) || locale === "en") notFound();
  return <TemplateDetailPage locale={locale} category={category} name={name} initial={await buildTemplate(name)} />;
}
