import { HomePage } from "@/components/pages/HomePage";

// The English landing page. Its <title>/description live on the root layout,
// which is where Next reads metadata for "/". The four translations are built
// by `app/(intl)/[locale]/page.tsx`.
export default function Home() {
  return <HomePage locale="en" />;
}
