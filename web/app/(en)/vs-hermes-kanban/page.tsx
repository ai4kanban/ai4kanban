import { PATH, VsHermesKanbanPage } from "@/components/pages/VsHermesKanbanPage";
import { englishMetadata } from "@/lib/comparisons";

export const metadata = englishMetadata(PATH);

export default function Page() {
  return <VsHermesKanbanPage locale="en" />;
}
