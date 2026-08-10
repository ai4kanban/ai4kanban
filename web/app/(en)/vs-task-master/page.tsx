import { PATH, VsTaskMasterPage } from "@/components/pages/VsTaskMasterPage";
import { englishMetadata } from "@/lib/comparisons";

export const metadata = englishMetadata(PATH);

export default function Page() {
  return <VsTaskMasterPage locale="en" />;
}
