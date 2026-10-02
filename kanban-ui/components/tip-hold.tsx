"use client";

// A tap keeps a tooltip open (#1371). A touch screen has no hover, and `:active` ends with
// the finger, so the tapped `.nb-tip` wears `data-tip-held` until the next press lands
// elsewhere. It only marks: no event is stopped, so the control still does what it does.
//
// A held tip is also kept readable (#1394): wrapped, nudged sideways and flipped to the other
// side so it stays inside what is visible. `globals.css` reads what `place` writes here.

import { useEffect } from "react";

const HELD = "data-tip-held";
const SIDE = "data-tip-side";
const MAX = "--tip-max";
const DX = "--tip-dx";
const WIDEST = 260;
const MARGIN = 8;

type Box = { left: number; top: number; right: number; bottom: number };

// The screen, cut down by every ancestor that clips what leaves it. Not the nearest alone:
// a column's own wrapper clips too, and is taller than the scroll area it sits in.
function visible(tip: HTMLElement): Box {
  const root = document.documentElement;
  const box = { left: 0, top: 0, right: root.clientWidth, bottom: root.clientHeight };
  for (let el = tip.parentElement; el && el !== document.body; el = el.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(el);
    if (overflowX === "visible" && overflowY === "visible") continue;
    const r = el.getBoundingClientRect();
    if (overflowX !== "visible") {
      box.left = Math.max(box.left, r.left + el.clientLeft);
      box.right = Math.min(box.right, r.left + el.clientLeft + el.clientWidth);
    }
    if (overflowY !== "visible") {
      box.top = Math.max(box.top, r.top + el.clientTop);
      box.bottom = Math.min(box.bottom, r.top + el.clientTop + el.clientHeight);
    }
  }
  return box;
}

// Where the bubble is drawn. A pseudo-element has no rect of its own, so it is read off its
// used style, which is relative to the tip's padding box.
function bubble(tip: HTMLElement): Box {
  const r = tip.getBoundingClientRect();
  const own = getComputedStyle(tip);
  const after = getComputedStyle(tip, "::after");
  const shift = after.transform === "none" ? 0 : new DOMMatrixReadOnly(after.transform).m41;
  const left = r.left + parseFloat(own.borderLeftWidth) + parseFloat(after.left) + shift;
  const top = r.top + parseFloat(own.borderTopWidth) + parseFloat(after.top);
  return { left, top, right: left + parseFloat(after.width), bottom: top + parseFloat(after.height) };
}

function clear(tip: HTMLElement) {
  tip.removeAttribute(SIDE);
  tip.style.removeProperty(MAX);
  tip.style.removeProperty(DX);
}

function place(tip: HTMLElement) {
  clear(tip);
  const room = visible(tip);
  const fits = (b: Box) => b.top >= room.top && b.bottom <= room.bottom;
  tip.style.setProperty(MAX, `${Math.min(WIDEST, room.right - room.left - 2 * MARGIN)}px`);
  let at = bubble(tip);
  if (!fits(at)) {
    const above = at.top < tip.getBoundingClientRect().top;
    tip.setAttribute(SIDE, above ? "below" : "above");
    const other = bubble(tip);
    if (fits(other)) at = other;
    else tip.removeAttribute(SIDE);
  }
  const lo = room.left + MARGIN;
  const hi = room.right - MARGIN;
  const dx = at.left < lo ? lo - at.left : at.right > hi ? hi - at.right : 0;
  if (dx) tip.style.setProperty(DX, `${dx}px`);
}

export function TipHold() {
  useEffect(() => {
    let held: HTMLElement | null = null;
    // A tip taken away while held must not come back open without a tap.
    const gone = new MutationObserver(() => {
      if (held && !held.hasAttribute("data-tip")) release();
    });
    const release = () => {
      if (held) {
        held.removeAttribute(HELD);
        clear(held);
      }
      held = null;
      gone.disconnect();
    };
    const press = (e: PointerEvent) => {
      const touched = e.pointerType === "touch" || e.pointerType === "pen";
      const tip = touched && e.target instanceof Element ? e.target.closest(".nb-tip[data-tip]") : null;
      if (tip === held) {
        // A second tap puts back a bubble that scrolled out of view.
        if (held) place(held);
        return;
      }
      release();
      if (!(tip instanceof HTMLElement)) return;
      held = tip;
      tip.setAttribute(HELD, "");
      place(tip);
      gone.observe(tip, { attributes: true, attributeFilter: ["data-tip"] });
    };
    const resize = () => {
      if (held) place(held);
    };
    // Capture: a control that stops its own press must still be seen.
    document.addEventListener("pointerdown", press, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", press, true);
      window.removeEventListener("resize", resize);
      release();
    };
  }, []);
  return null;
}
