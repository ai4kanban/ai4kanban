import type { Metadata } from "next";
import DraftSlice from "@demo/drafts";

// One of the home page's six workflow previews, which the page frames. Kept out of search, like
// /demo.
const KINDS = ["coding", "blog", "video", "slides", "carousel", "clone"];

export const metadata: Metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return KINDS.map((kind) => ({ kind }));
}

export default async function Page({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  return <DraftSlice kind={kind} />;
}
