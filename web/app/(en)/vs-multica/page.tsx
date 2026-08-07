import { PATH, VsMulticaPage } from "@/components/pages/VsMulticaPage";
import { englishMetadata } from "@/lib/comparisons";

export const metadata = englishMetadata(PATH);

export default function Page() {
  return <VsMulticaPage locale="en" />;
}
