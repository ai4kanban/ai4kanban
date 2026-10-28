import { FiAlertCircle } from "react-icons/fi";
import { Button } from "@review/components/button";
import { T } from "../i18n";
import { navigate } from "../router";
import { Window } from "../components/Window";

/** A page whose subject is not there: one line and the way home. */
export function Gone({ text }: { text: string }) {
  return (
    <Window>
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="flex max-w-[420px] items-start gap-2 text-[14px] leading-relaxed text-nb-ink-soft">
          <FiAlertCircle size={15} className="mt-[3px] shrink-0" aria-hidden />
          {text}
        </p>
        <Button size="sm" variant="ghost" onClick={() => navigate("/")}>
          {T.backHome}
        </Button>
      </div>
    </Window>
  );
}
