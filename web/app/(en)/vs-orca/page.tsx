import { PATH, VsOrcaPage } from "@/components/pages/VsOrcaPage";
import { englishMetadata } from "@/lib/comparisons";

export const metadata = englishMetadata(PATH);

export default function Page() {
  return <VsOrcaPage locale="en" />;
}
