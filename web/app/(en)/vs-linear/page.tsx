import { PATH, VsLinearPage } from "@/components/pages/VsLinearPage";
import { englishMetadata } from "@/lib/comparisons";

export const metadata = englishMetadata(PATH);

export default function Page() {
  return <VsLinearPage locale="en" />;
}
