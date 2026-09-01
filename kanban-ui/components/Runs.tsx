"use client";

// Runs: what the board does with a run whose agent has gone quiet (#394).
//
// One box of minutes. An agent that has wedged looks exactly like one still working, so
// without a limit the only backstop is you pressing Stop and a hung run holds its card for
// good. Past the limit the board ends the run and records it as a failure — the card does
// not advance, and Resume is still there. 0 switches it off.
//
// Repository-level, saved with the board beside the Delivery switches, so a team shares
// one answer.

import { useEffect, useState } from "react";
import { FiAlertCircle } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { setSilenceLimitAction, silenceLimitAction } from "@/app/actions";
import { CONTROL, Group, Panel, Row } from "./settings";

/** The **Runs** group of Configuration → General. It reads the limit from the board when it
 *  draws, and saves what you typed once you leave the box. */
export function RunsGroup({ onError }: { onError?: (msg: string) => void }) {
  const c = useCopy().configuration.runs;
  const caption = useCopy().configuration.general.runs;
  // What is in the box, and what the board last accepted — the second is what a rejected
  // save puts back, so a limit that silently didn't land can't be left on screen.
  const [typed, setTyped] = useState("");
  const [saved, setSaved] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void silenceLimitAction().then((res) => {
      if (!live) return;
      setSaved(res.minutes);
      setTyped(String(res.minutes));
      setLoadError(res.error ?? null);
    });
    return () => {
      live = false;
    };
  }, []);

  const save = async (text: string) => {
    // An emptied box is nothing typed, not 0 — deleting the number and tabbing away must not
    // switch the watchdog off. It puts the saved limit back, and says nothing.
    const written = text.trim();
    const minutes = written ? Number(written) : Number.NaN;
    // Leaving the box on the limit it already holds is not an answer to check — a
    // hand-edited fraction is honoured as written, and tabbing past it must not scold.
    if (minutes === saved) return;
    if (!Number.isInteger(minutes) || minutes < 0) {
      setTyped(String(saved ?? 0));
      if (written) onError?.(c.whole);
      return;
    }
    setTyped(String(minutes));
    const res = await setSilenceLimitAction(minutes);
    if (res.ok) setSaved(minutes);
    else {
      setTyped(String(saved ?? 0));
      onError?.(res.error || c.failed);
    }
  };

  return (
    <Group title={caption}>
      <Panel>
        <Row label={c.silence.title} hint={saved === 0 ? c.silence.off : c.silence.body}>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={typed}
            disabled={saved === null}
            aria-label={c.silence.title}
            onChange={(e) => setTyped(e.target.value)}
            onBlur={(e) => void save(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className={`${CONTROL} w-[90px] py-1 text-right font-[700]`}
          />
          <span className="text-[12px] text-nb-ink-soft">{c.silence.unit}</span>
        </Row>
      </Panel>

      {loadError && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-nb-ink-soft">
          <FiAlertCircle className="mt-[3px] shrink-0" aria-hidden />
          <span>{loadError}</span>
        </p>
      )}
    </Group>
  );
}
