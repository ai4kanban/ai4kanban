"use client";

// Configuration → Runtime (#443).
//
// One row per connector the board can run, in two groups: the ones this machine has, then
// the ones it hasn't. Opening a row shows how to REACH that connector — its provider, its
// endpoint, its key — plus **Make board default** and **Test**.
//
// Which model runs is not here. That belongs to the agent doing the work and is picked on the
// Agents pane, per machine; this pane is the tool and the tool alone. What it holds is the
// BOARD's, in docs/kanban/ui.config.json, except the keys, which are in docs/kanban/.env and
// never leave this computer.

import { useEffect, useState } from "react";
import { FiAlertCircle, FiChevronDown, FiChevronRight } from "react-icons/fi";
import { loggedOutAgentsAction, setHarnessAction } from "@/app/actions";
import { Rich } from "@/i18n/rich";
import { useCopy } from "@/i18n/use-copy";
import { pickedProvider, providerSetting } from "@/lib/providers";
import type { AgentInfo, HarnessOption } from "@/lib/types";
import { AgentMark, HarnessPicker } from "./Configuration";
import { CAPTION, QUIET_BTN } from "./settings";

export function RuntimesPanel({
  agent,
  onError,
}: {
  agent: AgentInfo;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.runtimes;
  // The whole setting as it now reads. Seeded from the page's first paint and replaced by
  // every save, so a connector made the default a moment ago wears its badge without a read
  // of its own.
  const [info, setInfo] = useState(agent);
  // The one connector that is open; every other is folded to a line. The board's default when
  // the pane opens — the answer most boards are here for.
  const [open, setOpen] = useState<string | null>(agent.name);
  // Which of them their own CLI says nobody is logged into (#392). It costs a spawn per CLI,
  // so it arrives after the rows are already on screen and never holds them up.
  const [loggedOut, setLoggedOut] = useState<Record<string, string>>({});

  useEffect(() => {
    let live = true;
    void loggedOutAgentsAction()
      .then((out) => {
        if (live) setLoggedOut(Object.fromEntries(out.map((one) => [one.harness, one.login])));
      })
      .catch(() => {
        // A connector nobody could ask about is one this pane says nothing about.
      });
    return () => {
      live = false;
    };
  }, []);

  // `=== false` on purpose: a board reading older rules doesn't answer this at all, and an
  // unanswered question counts as here rather than putting every connector under "not
  // installed".
  const here = info.options.filter((o) => o.installed !== false);
  const missing = info.options.filter((o) => o.installed === false);

  const row = (option: HarnessOption) => (
    <Row
      key={option.name}
      info={info}
      option={option}
      open={option.name === open}
      loggedOut={loggedOut[option.name]}
      onToggle={() => setOpen(option.name === open ? null : option.name)}
      onChanged={setInfo}
      onError={onError}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      {here.length > 0 && <Block caption={c.installed}>{here.map(row)}</Block>}
      {missing.length > 0 && <Block caption={c.notInstalled}>{missing.map(row)}</Block>}
      <p className="text-[12px] leading-relaxed text-nb-ink-soft">
        <Rich>{c.footer}</Rich>
      </p>
    </div>
  );
}

// One group of rows, under the word that says what they have in common.
function Block({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <section>
      <p className={`mb-2 ${CAPTION} text-nb-ink-soft`}>{caption}</p>
      <div className="overflow-hidden rounded-[12px] bg-nb-sheet">{children}</div>
    </section>
  );
}

/** What a folded row says on its right: the provider in effect, or the connector's own
 *  default where it declares no provider list. A CLI nobody is logged into says so instead —
 *  it is the one thing on the row that has something to do about it. */
function State({ option, loggedOut }: { option: HarnessOption; loggedOut?: string }) {
  const c = useCopy().configuration.runtimes;
  if (option.installed === false) {
    return (
      <code className="truncate rounded-[6px] bg-nb-ink/8 px-1.5 py-0.5 text-[11px] text-nb-ink-soft">
        {option.install}
      </code>
    );
  }
  if (loggedOut) {
    return <span className="truncate text-[12.5px] font-[700] text-nb-peach-ink">{c.loggedOut}</span>;
  }
  const list = providerSetting(option.settings);
  const picked = list
    ? pickedProvider(list, option.values[list.key] ?? "", (key) => {
        const setting = option.settings.find((s) => s.key === key);
        return setting?.kind === "secret"
          ? option.secretsSet.includes(key)
          : Boolean(option.values[key]);
      })
    : undefined;
  return (
    <span className="truncate text-[12.5px] text-nb-ink-soft">{picked?.label ?? c.ownDefault}</span>
  );
}

function DefaultBadge() {
  const c = useCopy().configuration.runtimes;
  return (
    <span className="shrink-0 rounded-[5px] bg-nb-accent-soft px-1.5 py-0.5 text-[9px] font-[800] uppercase leading-none tracking-[0.06em] text-nb-accent-deep">
      {c.boardDefault}
    </span>
  );
}

function Row({
  info,
  option,
  open,
  loggedOut,
  onToggle,
  onChanged,
  onError,
}: {
  info: AgentInfo;
  option: HarnessOption;
  open: boolean;
  loggedOut?: string;
  onToggle: () => void;
  onChanged: (agent: AgentInfo) => void;
  onError?: (msg: string) => void;
}) {
  const c = useCopy().configuration.runtimes;
  const [busy, setBusy] = useState(false);
  const isDefault = option.name === info.name;

  const makeDefault = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await setHarnessAction(option.name);
      if (!res.ok || !res.agent) {
        onError?.(res.error || c.defaultFailed(option.label));
        return;
      }
      onChanged(res.agent);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const head = (
    <>
      {open ? (
        <FiChevronDown className="shrink-0 text-[13px] text-nb-ink-soft" aria-hidden />
      ) : (
        <FiChevronRight className="shrink-0 text-[13px] text-nb-ink-soft" aria-hidden />
      )}
      {/* A connector this machine hasn't got wears a dimmed mark — the row it is in already
          says why, so nothing repeats it in words. */}
      <span style={{ opacity: option.installed === false ? 0.45 : 1 }}>
        <AgentMark src={option.icon} size={15} />
      </span>
      <span
        className={`shrink-0 text-[13.5px] ${open ? "font-[800]" : "font-[700]"} ${
          option.installed === false ? "text-nb-ink-soft" : "text-nb-ink"
        }`}
      >
        {option.label}
      </span>
      {isDefault && <DefaultBadge />}
    </>
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-2 border-t border-nb-ink/10 px-3.5 py-3 text-left first:border-t-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-nb-accent"
      >
        {head}
        <span className="ml-auto flex min-w-0 items-center">
          <State option={option} loggedOut={loggedOut} />
        </span>
      </button>
    );
  }

  return (
    <div className="border-t border-nb-ink/10 px-3.5 pb-3.5 pt-3 first:border-t-0">
      <div className="mb-2 flex min-h-[30px] items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={option.label}
          aria-expanded
          className="flex min-w-0 cursor-pointer items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-accent"
        >
          {head}
        </button>
        {!isDefault && (
          <span className="ml-auto shrink-0">
            <button type="button" disabled={busy} onClick={() => void makeDefault()} className={QUIET_BTN}>
              {c.makeDefault}
            </button>
          </span>
        )}
      </div>

      {/* This CLI is here and logged out (#392), with the command that logs it back in. It
          warns and stops nothing: a run under it still starts. */}
      {loggedOut && (
        <p className="mb-2 flex items-start gap-2 rounded-[9px] bg-nb-peach-soft px-2.5 py-[7px] text-[11.5px] leading-relaxed text-nb-peach-ink">
          <FiAlertCircle className="mt-[2px] shrink-0" aria-hidden />
          <span>
            <code className="rounded bg-nb-ink/8 px-1 py-0.5">{loggedOut}</code>
          </span>
        </p>
      )}

      {/* How to reach this connector, and the Test that says whether it answers. Keyed by
          what it runs, because every field is seeded once at mount. */}
      <HarnessPicker
        key={`${option.name}|${option.runs}`}
        agent={info}
        onError={onError}
        bind={{ harness: option.name, option, onSaved: onChanged }}
      />
    </div>
  );
}
