"use client";

// Optional usage reporting (#293) — the step that discloses it, and the switch that stays.
//
// Reporting is on by default, so the app owes every machine one plain statement of that
// before it is any use to us. That statement is the step below: it is shown once per
// MACHINE, ahead of the board and ahead of the guided first run, and **Continue** is the
// only way past it. It is not a setup-checklist box — the checklist is committed with the
// repository and asked once per board, while this answer follows the person to every
// project on the computer.
//
// Its switch starts on, and turning it off does not stop Continue. Nothing about this is a
// wall a "no" can't pass; the only thing it is is unskippable.
//
// The same switch stays in Configuration → General as the Privacy group, so a user who
// pressed through the step has one obvious place to go back to.

import { useCallback, useEffect, useRef, useState } from "react";
import { FiShield } from "react-icons/fi";
import {
  recordUsageDisclosureAction,
  setUsageReportingAction,
  usageReportingAction,
} from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import type { UsageReporting } from "@/lib/types";
import { Button } from "./button";
import { openLink } from "./desktop";
import { LogoMark } from "./Logo";
import { Alert, Group, Note, Panel, Row, Switch } from "./settings";

/** The published page that lists every event and field — what "Privacy details" opens, and
 *  what the Configuration row links to. In the app it opens the user's browser. */
const PRIVACY_URL = "https://ai4kanban.dev/privacy";

// ---- the onboarding step ----------------------------------------------------

/** The whole window, until it is answered. Drawn by components/BoardWindow.tsx ahead of
 *  both the board and the guided run, which is what makes it unskippable: nothing else is
 *  on screen to press. */
export function UsageDisclosure({ onDone }: { onDone: () => void }) {
  const t = useCopy();
  const c = t.setup.privacy;
  const [on, setOn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The switch starts on the machine's own answer where it has one — somebody who typed
  // `akb telemetry off` before ever opening the app is shown "off", not asked again from
  // scratch. Until that read lands the shown value is the default, which is also the answer.
  // A flip made in that gap wins: the read must never put back the "on" a user just said no
  // to, which is the one mistake this whole step exists to prevent.
  const touched = useRef(false);
  useEffect(() => {
    let alive = true;
    void usageReportingAction().then((held) => {
      if (alive && held && !touched.current) setOn(held.on);
    });
    return () => {
      alive = false;
    };
  }, []);

  const go = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await recordUsageDisclosureAction(on);
      // A save that did not land leaves the step where it is: the record is what the step
      // is gated on, so an unwritten one means it is still owed on the next open.
      if (!res.ok) {
        setError(res.error || c.saveFailed);
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    // The frame the guided run wears, minus its ways out. The top row is the window's title
    // bar in the app — `data-titlebar` is what leaves the traffic lights their gutter and
    // gives the window something to be dragged by — and it holds the mark alone, since
    // there is nothing here to press but Continue.
    <div className="flex h-screen flex-col overflow-hidden bg-nb-cream">
      <header
        data-titlebar
        className="flex h-[43px] shrink-0 items-center gap-2 px-3 pb-2 pt-[7px] max-md:pb-1 max-md:pt-[3px]"
      >
        <LogoMark />
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto rounded-tl-[14px] bg-nb-paper px-6 py-8 sm:px-9">
        <div className="w-full max-w-[430px] text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-nb-accent-soft">
            <FiShield size={22} className="text-nb-accent-deep" aria-hidden />
          </span>
          <h1 className="mt-4 text-[24px] font-[850] leading-tight tracking-[-0.02em]">{c.title}</h1>
          <p className="mx-auto mt-2 max-w-[38ch] text-[13px] leading-[19px] text-nb-ink-soft">{c.blurb}</p>

          <div className="nb-panel-sm mt-6 bg-nb-paper p-4 text-left">
            <div className="flex items-center justify-between gap-5">
              <span>
                <span className="block text-[13px] font-[800]">{c.share}</span>
                <span className="mt-1 block text-[11.5px] leading-[16px] text-nb-ink-soft">{c.shareNote}</span>
              </span>
              {/* Nothing is written here — the value is held until Continue, so a machine
                  that never answered has still sent nothing and saved nothing. */}
              <Switch
                on={on}
                label={(on ? c.switchOn : c.switchOff)(c.share)}
                busy={saving}
                onFlip={async (next) => {
                  touched.current = true;
                  setOn(next);
                }}
              />
            </div>
          </div>

          {error && (
            <div
              className="nb-panel-sm mt-4 break-words p-2.5 text-left text-[12px] leading-relaxed"
              style={{ background: "var(--color-nb-peach-soft)" }}
            >
              {error}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-4">
            <button
              type="button"
              className="cursor-pointer text-[12px] font-[750] text-nb-accent-deep underline-offset-2 hover:underline"
              onClick={() => openLink(PRIVACY_URL)}
            >
              {c.details} →
            </button>
            <Button disabled={saving} onClick={go}>
              {saving ? t.shared.saving : c.continue}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Configuration → General ------------------------------------------------

/** The **Privacy** group: one switch, the same sentence the step showed, the install id
 *  while there is one, and the link to the published list. */
export function PrivacyGroup({ onError }: { onError?: (msg: string) => void }) {
  const t = useCopy();
  const c = t.configuration.privacy;
  const caption = t.configuration.general.privacy;
  const [held, setHeld] = useState<UsageReporting | null>(null);
  // Whether the board's rules can answer at all. `null` from the read means they cannot,
  // and a switch that writes nowhere is worse than no switch.
  const [tooOld, setTooOld] = useState(false);

  const load = useCallback(async () => {
    const answer = await usageReportingAction();
    setHeld(answer);
    setTooOld(answer === null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flip = async (next: boolean) => {
    const was = held;
    setHeld(was ? { ...was, on: next } : was);
    const res = await setUsageReportingAction(next);
    if (!res.ok) {
      setHeld(was);
      onError?.(res.error || (next ? c.failedOn : c.failedOff));
      return;
    }
    // Turning it off forgets the id, and turning it on makes a new one at the first event —
    // so the row is re-read rather than guessed at.
    await load();
  };

  const unreadable = held?.unreadable === true;
  return (
    <Group title={caption}>
      <Panel>
        <Row label={c.title} hint={c.body}>
          {!tooOld && !unreadable && (
            <>
              {held && <span className="text-[12px] font-[800]">{held.on ? c.on : c.off}</span>}
              <Switch
                on={held ? held.on : null}
                label={(held?.on ? c.switchOn : c.switchOff)(c.title)}
                onFlip={flip}
              />
            </>
          )}
        </Row>
      </Panel>

      {tooOld ? (
        <Alert>{t.messages.tooOld.usageReporting}</Alert>
      ) : unreadable ? (
        <Alert>{c.unreadable}</Alert>
      ) : (
        <>
          <Note>
            <button
              type="button"
              className="cursor-pointer font-[700] text-nb-accent-deep underline-offset-2 hover:underline"
              onClick={() => openLink(PRIVACY_URL)}
            >
              {c.details} →
            </button>
          </Note>
          {/* The id this machine's reports carry, while there is one to show. Before the
              first event there is nothing — which is itself the honest answer. */}
          {held?.on && (
            <Note>{held.installId ? c.installId(held.installId) : c.nothingSent}</Note>
          )}
          <Note>{c.offNote}</Note>
        </>
      )}
    </Group>
  );
}
