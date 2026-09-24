"use client";

// What a built-in workflow is for, in a bubble beside its row in a workflow list (#1021).
// Shared by Configuration's picker and the create sheet's. Hover waits, keyboard focus does
// not, and a touch screen gets an info button instead.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiInfo } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { useMatches } from "@/lib/media";

const HOVER_DELAY = 400;
/** Moving from one row to the next once a bubble is up. */
const WARM_DELAY = 120;
/** Long enough to cross from the row to the bubble. */
const LEAVE_DELAY = 150;
const GAP = 8;
const EDGE = 8;
const WIDTH = 238;

/** A built-in's description in this language. A board's own workflow has none. */
export function useWorkflowDescription(): (flow: { id: string; builtIn: boolean }) => string | undefined {
  const texts = useCopy().configuration.workflows.builtInDescriptions;
  return useCallback((flow) => (flow.builtIn ? texts[flow.id as keyof typeof texts] : undefined), [texts]);
}

type Shown = { id: string; text: string; row: HTMLElement };

export function useWorkflowTip(menu: React.RefObject<HTMLElement | null>) {
  const describe = useWorkflowDescription();
  const about = useCopy().configuration.workflows.about;
  const touch = useMatches("(hover: none)");
  const base = useId();
  const [shown, setShown] = useState<Shown | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const cancel = () => window.clearTimeout(timer.current);
  const later = (fn: () => void, ms: number) => {
    cancel();
    timer.current = window.setTimeout(fn, ms);
  };
  const clear = useCallback(() => {
    window.clearTimeout(timer.current);
    setShown(null);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // A fixed bubble left behind by a moving page is worse than none.
  useEffect(() => {
    if (!shown) return;
    const onScroll = (e: Event) => {
      if (!(e.target instanceof Node && bubble.current?.contains(e.target))) clear();
    };
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", clear);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", clear);
    };
  }, [shown, clear]);

  const bubble = useRef<HTMLDivElement>(null);
  const descId = (id: string) => `${base}-${id}`;

  /** Spread on the element that picks the workflow. `anchor` is the whole row. */
  const rowProps = (flow: { id: string; builtIn: boolean }, anchor: () => HTMLElement | null) => {
    const text = describe(flow);
    if (!text) return { onPointerEnter: () => later(() => setShown(null), LEAVE_DELAY), onFocus: clear };
    const show = () => {
      const row = anchor();
      if (row) setShown({ id: flow.id, text, row });
    };
    return {
      "aria-describedby": descId(flow.id),
      onPointerEnter: (e: React.PointerEvent) => {
        if (e.pointerType === "mouse") later(show, shown ? WARM_DELAY : HOVER_DELAY);
      },
      onPointerLeave: (e: React.PointerEvent) => {
        if (e.pointerType === "mouse") later(() => setShown(null), LEAVE_DELAY);
      },
      onFocus: (e: React.FocusEvent<HTMLElement>) => {
        if (e.currentTarget.matches(":focus-visible")) {
          cancel();
          show();
        }
      },
      onBlur: () => {
        if (!touch) setShown((was) => (was?.id === flow.id ? null : was));
      },
    };
  };

  /** The touch screen's way in: a button beside the row, which only shows or hides. */
  const infoButton = (flow: { id: string; builtIn: boolean; name: string }, name: string, anchor: () => HTMLElement | null) => {
    const text = describe(flow);
    if (!touch || !text) return null;
    const open = shown?.id === flow.id;
    return (
      <button
        type="button"
        aria-label={about(name)}
        aria-expanded={open}
        aria-describedby={descId(flow.id)}
        onClick={(e) => {
          e.stopPropagation();
          const row = anchor();
          if (open || !row) clear();
          else setShown({ id: flow.id, text, row });
        }}
        className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-[7px] text-nb-ink-soft outline-none focus-visible:bg-nb-wash"
      >
        <FiInfo aria-hidden size={16} />
      </button>
    );
  };

  /** The texts every described row points at, and the bubble itself. */
  const layer = (flows: { id: string; builtIn: boolean }[]) => (
    <>
      {flows.map((f) => {
        const text = describe(f);
        return text ? (
          <span key={f.id} id={descId(f.id)} hidden>
            {text}
          </span>
        ) : null;
      })}
      {shown && (
        <Bubble
          box={bubble}
          shown={shown}
          menu={menu}
          onEnter={cancel}
          onLeave={() => {
            if (!touch) later(() => setShown(null), LEAVE_DELAY);
          }}
        />
      )}
    </>
  );

  return { shownId: shown?.id ?? null, clear, rowProps, infoButton, layer };
}

/** Outside the menu beside the row, flipped to the other side when there is no room, and
 *  above or below the whole menu when neither side has it — never over another row. */
function Bubble({
  box: ref,
  shown,
  menu,
  onEnter,
  onLeave,
}: {
  box: React.RefObject<HTMLDivElement | null>;
  shown: Shown;
  menu: React.RefObject<HTMLElement | null>;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const [place, setPlace] = useState<React.CSSProperties | null>(null);
  useLayoutEffect(() => {
    const frame = menu.current?.getBoundingClientRect();
    const el = ref.current;
    if (!frame || !el) return;
    const row = shown.row.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(WIDTH, vw - 2 * EDGE);
    el.style.width = `${width}px`;
    const height = el.offsetHeight;
    const top = Math.min(Math.max(row.top, EDGE), vh - EDGE - height);
    if (frame.right + GAP + width <= vw - EDGE) return setPlace({ left: frame.right + GAP, top, width });
    if (frame.left - GAP - width >= EDGE) return setPlace({ left: frame.left - GAP - width, top, width });
    const left = Math.min(Math.max(frame.right - width, EDGE), vw - EDGE - width);
    const above = frame.top - GAP - height >= EDGE;
    setPlace({ left, width, top: above ? frame.top - GAP - height : Math.min(frame.bottom + GAP, vh - EDGE - height) });
  }, [shown, menu, ref]);

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      data-workflow-tip
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      // Reading it must not pull focus out of the menu.
      onMouseDown={(e) => e.preventDefault()}
      className="a4k-nodrag fixed z-[70] rounded-[6px] bg-nb-ink px-[7px] py-1 text-[10.5px] font-[700] leading-[16px] text-nb-cream"
      style={place ?? { visibility: "hidden", top: 0, left: 0 }}
    >
      {shown.text}
    </div>,
    document.body,
  );
}
