import { AssetRoute } from "@/components/AssetRoute";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ src: string[] }> }) {
  const { src } = await params;
  return <AssetRoute folder=".assets" segments={src} />;
}
