import { headers } from "next/headers";
import { NoticePage } from "../components/Frame";
import { getHostedCopy } from "../lib/copy";
import { languageFor } from "../lib/reader";

// A path this app does not have gets the refusal a workspace nobody may read gets. There is
// nothing else here to be told about, and a 404 that read differently would be one more way
// to learn which ids are real.
export default async function NotFound() {
  const copy = getHostedCopy(languageFor((await headers()).get("accept-language")));
  return <NoticePage copy={copy}>{copy.refused}</NoticePage>;
}
