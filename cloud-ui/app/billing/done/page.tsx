import { headers } from "next/headers";
import { FiCheck } from "react-icons/fi";
import { Page } from "../../../components/Frame";
import { getHostedCopy } from "../../../lib/copy";
import { languageFor } from "../../../lib/reader";

// Where a checkout started in the desktop app lands (#1109). Public on purpose: the app holds
// the sign-in, so this page reads no account and asks for none.
export default async function CheckoutDone() {
  const copy = getHostedCopy(languageFor((await headers()).get("accept-language")));
  return (
    <Page copy={copy} bare>
      <span className="grid size-10 place-items-center rounded-full bg-nb-mint-soft text-nb-mint-ink" aria-hidden>
        <FiCheck size={20} strokeWidth={3} />
      </span>
      <h1 className="text-[22px] font-[800] tracking-[-0.01em] text-nb-ink">{copy.checkoutDone}</h1>
      <p className="text-[15px] leading-relaxed text-nb-ink">{copy.checkoutDoneBody}</p>
    </Page>
  );
}
