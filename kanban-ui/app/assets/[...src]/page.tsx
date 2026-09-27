import { AssetRoute } from "@/components/AssetRoute";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ src: string[] }>;
  searchParams: Promise<{ device?: string }>;
}) {
  const { src } = await params;
  const { device } = await searchParams;
  return <AssetRoute folder=".assets" segments={src} device={device} />;
}
