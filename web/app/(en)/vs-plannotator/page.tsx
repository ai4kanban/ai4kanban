import { PATH, VsPlannotatorPage } from "@/components/pages/VsPlannotatorPage";
import { englishMetadata } from "@/lib/comparisons";

export const metadata = englishMetadata(PATH);

export default function Page() {
  return <VsPlannotatorPage locale="en" />;
}
