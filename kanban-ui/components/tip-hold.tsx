"use client";

// A tap keeps a tooltip open (#1371). A touch screen has no hover, and `:active` ends with
// the finger, so the tapped `.nb-tip` wears `data-tip-held` until the next press lands
// elsewhere. It only marks: no event is stopped, so the control still does what it does.

import { useEffect } from "react";

const HELD = "data-tip-held";

export function TipHold() {
  useEffect(() => {
    let held: Element | null = null;
    // A tip taken away while held must not come back open without a tap.
    const gone = new MutationObserver(() => {
      if (held && !held.hasAttribute("data-tip")) release();
    });
    const release = () => {
      held?.removeAttribute(HELD);
      held = null;
      gone.disconnect();
    };
    const press = (e: PointerEvent) => {
      const touched = e.pointerType === "touch" || e.pointerType === "pen";
      const tip = touched && e.target instanceof Element ? e.target.closest(".nb-tip[data-tip]") : null;
      if (tip === held) return;
      release();
      if (!tip) return;
      held = tip;
      tip.setAttribute(HELD, "");
      gone.observe(tip, { attributes: true, attributeFilter: ["data-tip"] });
    };
    // Capture: a control that stops its own press must still be seen.
    document.addEventListener("pointerdown", press, true);
    return () => {
      document.removeEventListener("pointerdown", press, true);
      release();
    };
  }, []);
  return null;
}
