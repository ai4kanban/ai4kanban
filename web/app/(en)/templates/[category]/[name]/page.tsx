import { TemplateDetailPage } from "@/components/templates/TemplatesPage";
import { templateMetadata, templateParams } from "@/lib/template-route";
import { buildTemplate } from "@/lib/templates";

// One template's page in English. Chinese is the `(intl)` twin of this route.

type Props = { params: Promise<{ category: string; name: string }> };

export const generateStaticParams = templateParams;

export async function generateMetadata({ params }: Props) {
  const { category, name } = await params;
  return templateMetadata("en", category, name);
}

export default async function Page({ params }: Props) {
  const { category, name } = await params;
  return <TemplateDetailPage locale="en" category={category} name={name} initial={await buildTemplate(name)} />;
}
