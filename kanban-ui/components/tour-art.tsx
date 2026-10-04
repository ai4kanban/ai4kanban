"use client";

// The welcome tour's five loops (#1500). Each scene's resting styles are its finished state,
// so `prefers-reduced-motion` shows the outcome rather than a blank stage.

import type { ReactElement } from "react";
import { FiCheck, FiCode, FiFileText, FiFilm, FiImage, FiMail, FiX } from "react-icons/fi";
import type { TourCopy } from "@/i18n/tour/types";

const box = "rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper shadow-[2px_2px_0_0_var(--color-nb-ink)]";
const line = (w: string) => <div className="h-[6px] rounded-full bg-nb-ink/15" style={{ width: w }} />;

// 1 · a long spec fades behind a mockup you can judge at a glance; one click approves it.
// The resting styles are the finished state, so reduced motion shows the approved draft.
const DRAFT_KF = `
@keyframes d-idea { 0% { opacity:0; transform:translateY(-6px) } 6%,92% { opacity:1; transform:none } 100% { opacity:0 } }
@keyframes d-spec { 0%,6% { opacity:0 } 12%,24% { opacity:1 } 34%,92% { opacity:.35 } 100% { opacity:0 } }
@keyframes d-mock { 0%,24% { opacity:0; transform:translate(24px,6px) rotate(3deg) } 34%,92% { opacity:1; transform:none } 100% { opacity:0 } }
@keyframes d-dark { 0%,42% { opacity:0 } 48%,92% { opacity:1 } 100% { opacity:0 } }
@keyframes d-knob { 0%,42% { transform:none } 48%,100% { transform:translateX(10px) } }
@keyframes d-ptr { 0%,50% { opacity:0; transform:translate(-90px,-70px) } 56% { opacity:1 } 64% { transform:none } 67% { transform:scale(.88) } 70%,86% { opacity:1; transform:none } 92%,100% { opacity:0 } }
@keyframes d-btn { 0%,67% { background:var(--color-nb-accent) } 70%,92% { background:var(--color-nb-mint) } 100% { background:var(--color-nb-accent) } }
@keyframes d-ok { 0%,68% { opacity:0; transform:scale(.6) } 72%,92% { opacity:1; transform:none } 100% { opacity:0 } }
.d-idea { animation: d-idea 7s infinite both }
.d-spec { opacity:.35; animation: d-spec 7s infinite both }
.d-mock { animation: d-mock 7s ease-out infinite both }
.d-dark { animation: d-dark 7s infinite both }
.d-knob { transform:translateX(10px); animation: d-knob 7s infinite both }
.d-ptr { opacity:0; animation: d-ptr 7s ease-in-out infinite both }
.d-btn { background:var(--color-nb-mint); animation: d-btn 7s infinite both }
.d-ok { animation: d-ok 7s infinite both }
@keyframes d-skip { 0%,26% { opacity:0; transform:rotate(-8deg) scale(1.4) } 30%,92% { opacity:1; transform:rotate(-8deg) } 100% { opacity:0 } }
.d-skip { animation: d-skip 7s infinite both }
@media (prefers-reduced-motion: reduce) { .d-idea,.d-spec,.d-mock,.d-dark,.d-knob,.d-ptr,.d-btn,.d-ok,.d-skip { animation:none } }
`;

function ArtDraft({ copy }: { copy: TourCopy }) {
  const c = copy.draft;
  return (
    <div className="relative h-[270px] w-[330px]">
      <style>{DRAFT_KF}</style>
      <div className={`${box} d-idea absolute left-0 top-0 rotate-[-2deg] bg-[#fff7c9] px-3 py-1.5 text-[13px] font-[750]`}>
        💡 {c.idea}
      </div>
      {/* The spec nobody wants to read */}
      <div className={`${box} d-spec absolute left-0 top-[48px] w-[132px] p-2.5`}>
        <div className="text-[10.5px] font-[800]">{c.spec}</div>
        <div className="mb-2" />
        <div className="space-y-[5px]">
          {["95%", "88%", "92%", "70%", "96%", "84%", "90%", "60%", "93%", "86%", "91%", "75%", "89%", "66%"].map((w, i) => (
            <div key={i} className="h-[4px] rounded-full bg-nb-ink/20" style={{ width: w }} />
          ))}
        </div>
      </div>
      {/* The spec is struck off: the preview replaces reading it */}
      <div className="d-skip absolute left-[6px] top-[200px] rotate-[-8deg] rounded-[6px] border-2 border-nb-accent bg-nb-paper px-2 py-0.5 text-[11px] font-[850] text-nb-accent">
        {c.skip}
      </div>
      {/* The mockup: a settings screen whose theme switch flips it dark */}
      <div className={`${box} d-mock absolute right-0 top-[36px] w-[214px] overflow-hidden`}>
        <div className="flex gap-1 border-b border-nb-ink/15 bg-nb-paper px-2 py-1.5">
          <span className="size-2 rounded-full bg-nb-peach" />
          <span className="size-2 rounded-full bg-nb-sky" />
          <span className="size-2 rounded-full bg-nb-mint" />
        </div>
        <div className="relative h-[132px]">
          <div className="absolute inset-0 flex gap-2 bg-nb-paper p-2.5">
            <div className="w-[44px] space-y-2">{line("100%")}{line("75%")}{line("85%")}</div>
            <div className="flex-1 space-y-2.5">
              <div className="h-[30px] rounded-[6px] bg-nb-accent-soft" />
              {line("90%")}
              {line("70%")}
            </div>
          </div>
          <div className="d-dark absolute inset-0 flex gap-2 bg-[#24231f] p-2.5">
            <div className="w-[44px] space-y-2">
              {["100%", "75%", "85%"].map((w) => <div key={w} className="h-[6px] rounded-full bg-white/25" style={{ width: w }} />)}
            </div>
            <div className="flex-1 space-y-2.5">
              <div className="h-[30px] rounded-[6px] bg-nb-accent/70" />
              <div className="h-[6px] w-[90%] rounded-full bg-white/25" />
              <div className="h-[6px] w-[70%] rounded-full bg-white/25" />
            </div>
          </div>
          <div className="absolute bottom-2.5 right-2.5 flex h-[14px] w-[24px] items-center rounded-full border-[1.5px] border-nb-ink bg-nb-paper px-[1px]">
            <span className="d-knob size-[9px] rounded-full bg-nb-ink" />
          </div>
        </div>
      </div>
      {/* One click approves it */}
      <div className="absolute bottom-[14px] right-0 flex items-center gap-2">
        <span className="d-ok inline-flex items-center gap-1 rounded-full bg-nb-paper px-2 py-0.5 text-[12px] font-[750] text-nb-mint-ink">
          <FiCheck size={12} strokeWidth={3.5} /> {c.approved}
        </span>
        <span className="d-btn relative rounded-[8px] border-[1.5px] border-nb-ink px-4 py-1.5 text-[13px] font-[800] text-white shadow-[2px_2px_0_0_var(--color-nb-ink)]">
          {c.approve}
          <svg className="d-ptr absolute left-[34px] top-[18px]" width="18" height="22" viewBox="0 0 18 22" aria-hidden>
            <path d="M1 1 L1 17 L5.5 13 L9 21 L12 19.5 L8.5 12 L15 12 Z" fill="#fff" stroke="#24231f" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </div>
  );
}

function Ptr({ className }: { className: string }) {
  return (
    <svg className={`${className} pointer-events-none absolute`} width="18" height="22" viewBox="0 0 18 22" aria-hidden>
      <path d="M1 1 L1 17 L5.5 13 L9 21 L12 19.5 L8.5 12 L15 12 Z" fill="#fff" stroke="#24231f" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// A thing that appears at `at`% of the cycle and stays until it all fades for the loop.
// Its resting style is visible, so reduced motion shows the finished scene.
const appear = (name: string, at: number) => `
@keyframes ${name} { 0%,${at}% { opacity:0; transform:translateY(6px) } ${at + 5}%,92% { opacity:1; transform:none } 100% { opacity:0 } }
.${name} { animation: ${name} 7s infinite both }`;
// The opposite: visible until `at`%, then gone; hidden at rest.
const vanish = (name: string, at: number) => `
@keyframes ${name} { 0%,${at}% { opacity:1 } ${at + 2}%,100% { opacity:0 } }
.${name} { opacity:0; animation: ${name} 7s infinite both }`;
const still = (names: string[]) =>
  `@media (prefers-reduced-motion: reduce) { ${names.map((n) => "." + n).join(",")} { animation:none } }`;

// 2 · a build finishes; agents list what it missed, and one click puts a gap on the board
const GAPS_KF = [
  appear("g-found", 14),
  appear("g-r0", 20),
  appear("g-r1", 26),
  appear("g-r2", 32),
  vanish("g-add", 64),
  appear("g-added", 64),
  `@keyframes g-ptr { 0%,40% { opacity:0; transform:translate(-120px,-40px) } 46% { opacity:1 } 58% { transform:none } 61% { transform:scale(.88) } 64%,86% { opacity:1; transform:none } 92%,100% { opacity:0 } }
.g-ptr { opacity:0; animation: g-ptr 7s ease-in-out infinite both }`,
  still(["g-found", "g-r0", "g-r1", "g-r2", "g-add", "g-added", "g-ptr"]),
].join("\n");

function ArtGaps({ copy }: { copy: TourCopy }) {
  const c = copy.gaps;
  return (
    <div className="relative w-[330px]">
      <style>{GAPS_KF}</style>
      <div className={`${box} p-3`}>
        <div className="flex items-center justify-between text-[13px] font-[800]">
          <span>{c.main}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-nb-mint-soft px-2 py-0.5 text-[10.5px] font-[700] text-nb-mint-ink">
            <FiCheck size={10} strokeWidth={4} /> {c.done}
          </span>
        </div>
        <div className="mt-2.5 h-[7px] rounded-full bg-nb-ink/10">
          <div className="h-full w-full rounded-full bg-nb-mint" />
        </div>
      </div>
      <div className="g-found mb-2 mt-4 text-[11.5px] font-[750] text-nb-ink-soft">✦ {c.found}</div>
      <div className="space-y-2">
        {c.rows.map((r, i) => (
          <div key={r} className={`${box} g-r${i} relative flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-[650]`}>
            <span className="size-2 shrink-0 rounded-full bg-nb-peach" />
            <span className="min-w-0 flex-1 truncate">{r}</span>
            {i === 0 ? (
              <span className="relative grid shrink-0">
                <span className="g-add col-start-1 row-start-1 rounded-[6px] border-[1.5px] border-nb-ink px-2 text-[11px] font-[800]">+ {c.add}</span>
                <span className="g-added col-start-1 row-start-1 inline-flex items-center gap-1 text-[11px] font-[800] text-nb-mint-ink">
                  <FiCheck size={11} strokeWidth={3.5} /> {c.added}
                </span>
                <Ptr className="g-ptr left-[22px] top-[10px]" />
              </span>
            ) : (
              <span className="shrink-0 rounded-[6px] border-[1.5px] border-nb-ink px-2 text-[11px] font-[800]">+ {c.add}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 3 · code, video, carousel, blog and email cards all crossing to Done together
const FLOW_ICONS = [FiCode, FiFilm, FiImage, FiFileText, FiMail];
const FLOWS_KF = [
  ...FLOW_ICONS.map((_, i) => {
    const at = 18 + i * 9;
    return `@keyframes f-c${i} { 0%,3% { opacity:0; transform:none } 6%,${at}% { opacity:1; transform:none } ${at + 10}%,92% { opacity:1; transform:translateX(196px) } 97%,100% { opacity:0; transform:translateX(196px) } }
.f-c${i} { transform:translateX(196px); animation: f-c${i} 7s ease-in-out infinite both }
@keyframes f-k${i} { 0%,${at + 10}% { opacity:0 } ${at + 13}%,92% { opacity:1 } 100% { opacity:0 } }
.f-k${i} { animation: f-k${i} 7s infinite both }`;
  }),
  still(FLOW_ICONS.flatMap((_, i) => [`f-c${i}`, `f-k${i}`])),
].join("\n");

function ArtWorkflows({ copy }: { copy: TourCopy }) {
  const c = copy.flows;
  return (
    <div className="relative h-[250px] w-[376px]">
      <style>{FLOWS_KF}</style>
      {[c.doing, c.done].map((h, i) => (
        <div key={h} className="absolute top-0 h-full w-[180px] rounded-[10px] bg-nb-paper/60" style={{ left: i * 196 }}>
          <div className="px-2.5 pt-2 text-[11px] font-[800] text-nb-ink-soft">{h}</div>
        </div>
      ))}
      {c.cards.map((t, i) => {
        const Icon = FLOW_ICONS[i];
        return (
          <div key={t} className={`${box} f-c${i} absolute left-[4px] flex h-[34px] w-[172px] items-center gap-2 px-2 text-[11.5px] font-[700]`} style={{ top: 28 + i * 43 }}>
            <Icon size={13} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{t}</span>
            <span className={`f-k${i} grid size-4 shrink-0 place-items-center rounded-full bg-nb-mint text-white`}>
              <FiCheck size={10} strokeWidth={4} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

// 4 · each thing you say lands in the one memory it belongs to: an agent's or a module's
const fly = (name: string, at: number, x: number, y: number) => `
@keyframes ${name} { 0%,${at}% { opacity:0; transform:translateY(6px) } ${at + 4}%,${at + 14}% { opacity:1; transform:none } ${at + 22}%,100% { opacity:0; transform:translate(${x}px,${y}px) scale(.4) } }
.${name} { opacity:0; animation: ${name} 7s ease-in-out infinite both }`;
const MEMORY_KF = [
  fly("m-say0", 2, -150, 60),
  appear("m-line0", 24),
  fly("m-say1", 36, -150, 150),
  appear("m-line1", 58),
  still(["m-say0", "m-line0", "m-say1", "m-line1"]),
].join("\n");

function ArtMemory({ copy }: { copy: TourCopy }) {
  const c = copy.memory;
  // files[0] takes says[0], files[2] takes says[1]
  const target = (i: number) => (i === 0 ? 0 : i === 2 ? 1 : -1);
  return (
    <div className="relative h-[300px] w-[340px]">
      <style>{MEMORY_KF}</style>
      {c.says.map((s, i) => (
        <div key={s} className={`m-say${i} absolute right-0 rounded-[12px] rounded-br-[3px] bg-nb-ink px-3 py-1.5 text-[12px] font-[700] text-white`} style={{ top: 0 }}>
          {s}
        </div>
      ))}
      {[c.agents, c.modules].map((g, row) => (
        <div key={g} className="absolute left-0 right-0" style={{ top: 48 + row * 128 }}>
          <div className="mb-1 text-[10.5px] font-[800] text-nb-ink-soft">{g}</div>
          <div className="grid grid-cols-2 gap-3">
            {c.files.slice(row * 2, row * 2 + 2).map((f, j) => {
              const k = target(row * 2 + j);
              return (
                <div key={f} className={`${box} h-[96px] p-2.5`}>
                  <div className="text-[11px] font-[800]">{f}</div>
                  <div className="mt-2 space-y-1.5">
                    {line("85%")}
                    {line("60%")}
                  </div>
                  {k >= 0 && (
                    <div className={`m-line${k} mt-1.5 rounded-[4px] bg-nb-lilac-soft px-1.5 py-0.5 text-[10.5px] font-[700] leading-[14px]`}>+ {c.says[k]}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// 5 · an agent uses the product like a user; one step fails and becomes feedback
const QA_KF = [
  `@keyframes q-ptr { 0%,6% { opacity:0; transform:translate(20px,-30px) } 10% { opacity:1; transform:translate(20px,-30px) } 20% { transform:translate(0,0) } 34% { transform:translate(0,46px) } 50%,86% { opacity:1; transform:translate(0,112px) } 92%,100% { opacity:0; transform:translate(0,112px) } }
.q-ptr { opacity:0; animation: q-ptr 7s ease-in-out infinite both }`,
  appear("q-s0", 22),
  appear("q-s1", 36),
  appear("q-s2", 52),
  appear("q-fb", 62),
  still(["q-ptr", "q-s0", "q-s1", "q-s2", "q-fb"]),
].join("\n");

function ArtQa({ copy }: { copy: TourCopy }) {
  const c = copy.qa;
  return (
    <div className="relative h-[270px] w-[330px]">
      <style>{QA_KF}</style>
      {/* A phone screen whose Export button sits under the bottom bar */}
      <div className={`${box} absolute left-0 top-0 h-[190px] w-[130px] overflow-hidden`}>
        <div className="space-y-2 p-2.5">
          <div className="text-[11px] font-[800]">{c.signup}</div>
          <div className="rounded-[5px] border border-nb-ink/30 px-1.5 py-1 text-[10px] text-nb-ink-soft">{c.email}</div>
          <div className="rounded-[6px] bg-nb-accent py-1 text-center text-[10.5px] font-[800] text-white">{c.signup}</div>
          {line("80%")}
          {line("60%")}
        </div>
        <div className="absolute bottom-[14px] left-2.5 right-2.5 rounded-[6px] border-[1.5px] border-nb-ink py-1 text-center text-[10.5px] font-[800]">{c.export}</div>
        <div className="absolute bottom-0 left-0 right-0 flex h-[26px] items-center justify-around border-t border-nb-ink/20 bg-nb-paper">
          {[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-nb-ink/20" />)}
        </div>
        <Ptr className="q-ptr left-[60px] top-[52px]" />
      </div>
      <div className="absolute left-[150px] top-[10px] space-y-2">
        {c.steps.map((s, i) => (
          <div key={s} className={`q-s${i} flex items-center gap-2 text-[12px] font-[700]`}>
            <span className={`grid size-4 place-items-center rounded-full text-white ${i < 2 ? "bg-nb-mint" : "bg-nb-accent"}`}>
              {i < 2 ? <FiCheck size={10} strokeWidth={4} /> : <FiX size={10} strokeWidth={4} />}
            </span>
            {s}
          </div>
        ))}
      </div>
      <div className={`${box} q-fb absolute bottom-0 right-0 w-[230px] p-2.5`}>
        <div className="text-[10px] font-[800] text-nb-peach-ink">{c.label}</div>
        <div className="mt-1 text-[12px] font-[700] leading-[17px]">{c.feedback}</div>
      </div>
    </div>
  );
}

export const TOUR_ART: ((p: { copy: TourCopy }) => ReactElement)[] = [ArtDraft, ArtGaps, ArtWorkflows, ArtMemory, ArtQa];
