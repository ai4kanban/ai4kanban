import { PATH, VsVibePage } from "@/components/pages/VsVibePage";
import { englishMetadata } from "@/lib/comparisons";

export const metadata = englishMetadata(PATH);

export default function Page() {
  return <VsVibePage locale="en" />;
}
