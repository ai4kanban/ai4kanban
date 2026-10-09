import type { ReactNode } from "react";
import { FiArrowRight, FiCheck, FiLock, FiShare2, FiX } from "react-icons/fi";
import type { VsForm, VsQuestionsHero, VsTopicsHero } from "@/i18n/types";

// One scene per hero column. AI4Kanban's side uses its agents' pixel art, the
// brand's mascot; the rival's side is drawn by its page from the parts below.
// Scenes sit straight on the column's ground, with no frame of their own.

type Hero = VsTopicsHero;

const art = (name: string) => `/agent-art/${name}.png`;

const Scene = ({ children }: { children: ReactNode }) => (
  <div className="flex h-40 items-center justify-center gap-4">{children}</div>
);

function Bot({ name }: { name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={art(name)}
      alt=""
      width={72}
      height={72}
      className="[image-rendering:pixelated]"
    />
  );
}

const Label = ({ children, tone = "text-muted" }: { children: string; tone?: string }) => (
  <span className={`mt-1 text-xs ${tone}`}>{children}</span>
);

// Bots and status marks share one box height, so every label sits on one line.
const Slot = ({ children }: { children: ReactNode }) => (
  <div className="flex h-[72px] items-center justify-center">{children}</div>
);

const Step = ({ children, label }: { children: ReactNode; label: string }) => (
  <div className="flex flex-col items-center">
    <Slot>{children}</Slot>
    <Label tone="text-ink">{label}</Label>
  </div>
);

const Arrow = () => (
  <FiArrowRight className="mb-5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
);

export function SetupOurs({ c }: { c: Hero["setup"]["art"]["ours"] }) {
  return (
    <Scene>
      {["ui-designer", "prompt-writer", "copywriting"].map((name, i) => (
        <Step key={name} label={c[i]}>
          <Bot name={name} />
        </Step>
      ))}
    </Scene>
  );
}

// A generic agent, dashed: one that does not exist yet.
export function EmptyAgent() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" className="text-muted">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" opacity="0.5">
        <circle cx="32" cy="22" r="11" />
        <path d="M12 56 a20 18 0 0 1 40 0 z" strokeLinejoin="round" />
      </g>
      <circle cx="48" cy="44" r="9" fill="var(--color-elev)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M48 40 v8 M44 44 h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export const EmptySlot = ({ children }: { children: ReactNode }) => (
  <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-[color-mix(in_srgb,var(--color-ink)_30%,transparent)] text-muted [&>svg]:h-6 [&>svg]:w-6">
    {children}
  </span>
);

// A form the rival leaves you with, and what it makes.
export function FormScene({ c, children }: { c: VsForm; children: ReactNode }) {
  return (
    <Scene>
      <div className="w-36 rounded-lg bg-elev p-2.5 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-ink)_10%,transparent)]">
        <p className="text-xs font-semibold text-ink">{c.title}</p>
        {c.fields.map((f) => (
          <div key={f} className="mt-2">
            <p className="text-[0.65rem] text-muted">{f}</p>
            <div className="mt-0.5 h-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-ink)_10%,transparent)]" />
          </div>
        ))}
      </div>
      <FiArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      <div className="flex flex-col items-center">
        <Slot>{children}</Slot>
        <Label>{c.slot}</Label>
      </div>
    </Scene>
  );
}

// What the rival does not build in, crossed off.
export const MissingList = ({ c }: { c: VsForm }) => (
  <Scene>
    <div className="rounded-lg bg-elev p-3 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-ink)_10%,transparent)]">
      <p className="text-xs font-semibold text-ink">{c.title}</p>
      {c.fields.map((f) => (
        <p key={f} className="mt-2 flex items-center gap-2 text-xs text-muted">
          <FiX className="h-3.5 w-3.5" aria-hidden="true" />
          {f}
        </p>
      ))}
      <p className="mt-3 text-xs font-semibold text-muted">{c.slot}</p>
    </div>
  </Scene>
);

// The designer's draft is approved, then the builder runs it.
export function DraftsOurs({ c }: { c: Hero["drafts"]["art"]["ours"] }) {
  return (
    <Scene>
      <Step label={c[0]}>
        <Bot name="ui-designer" />
      </Step>
      <Arrow />
      <Step label={c[1]}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-growth text-elev">
          <FiCheck className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
        </span>
      </Step>
      <Arrow />
      <Step label={c[2]}>
        <Bot name="builder" />
      </Step>
    </Scene>
  );
}


const chip =
  "inline-flex items-center gap-1 rounded-md border bg-elev px-1.5 py-0.5 font-mono text-[0.62rem] font-semibold text-ink";

// Each specialist keeps its own locked notes; both read one shared memory, and
// neither's own notes flow into it.
export function MemoryOurs({ c }: { c: Hero["memory"]["art"]["ours"] }) {
  const agent = (name: string, i: number) => (
    <div className="flex flex-col items-center">
      <Slot>
        <Bot name={name} />
      </Slot>
      <Label tone="text-ink">{c.agents[i]}</Label>
      <span className={`${chip} mt-1.5 border-[color-mix(in_srgb,var(--color-ink)_18%,transparent)]`}>
        <FiLock className="h-3 w-3 text-muted" aria-hidden="true" />
        {c.notes[i]}
      </span>
    </div>
  );
  const wire = <span className="mb-[3.25rem] h-px w-5 bg-growth" aria-hidden="true" />;
  return (
    <Scene>
      {agent("ui-designer", 0)}
      <div className="flex items-center">
        {wire}
        <span className={`${chip} mb-[3.25rem] border-growth`}>
          <FiShare2 className="h-3 w-3 text-growth" aria-hidden="true" />
          {c.shared}
        </span>
        {wire}
      </div>
      {agent("copywriting", 1)}
    </Scene>
  );
}

// Questions settled, key points approved, then the builder runs.
export function QuestionsOurs({ c }: { c: VsQuestionsHero["questions"]["art"]["ours"] }) {
  return (
    <Scene>
      <Step label={c[0]}>
        <Bot name="planner" />
      </Step>
      <Arrow />
      <Step label={c[1]}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-growth text-elev">
          <FiCheck className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
        </span>
      </Step>
      <Arrow />
      <Step label={c[2]}>
        <Bot name="builder" />
      </Step>
    </Scene>
  );
}
