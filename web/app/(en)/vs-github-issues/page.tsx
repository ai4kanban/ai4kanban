import { PATH, VsGithubPage } from "@/components/pages/VsGithubPage";
import { englishMetadata } from "@/lib/comparisons";

export const metadata = englishMetadata(PATH);

export default function Page() {
  return <VsGithubPage locale="en" />;
}
