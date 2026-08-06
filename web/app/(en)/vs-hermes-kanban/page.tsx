import { PATH, VsHermesPage } from "@/components/pages/VsHermesPage";
import { englishMetadata } from "@/lib/comparisons";

export const metadata = englishMetadata(PATH);

export default function Page() {
  return <VsHermesPage locale="en" />;
}
