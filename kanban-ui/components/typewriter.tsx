"use client";

import { useEffect, useState } from "react";

/** Types each phrase in, holds it, deletes it and moves to the next. Paused or under reduced
 *  motion it shows the current phrase whole and `typing` is false — draw no caret then. */
export function useTypewriter(phrases: readonly string[], paused = false) {
  const [frame, setFrame] = useState({ index: 0, length: phrases[0].length, deleting: false });
  const [reducedMotion, setReducedMotion] = useState(true);
  const phrase = phrases[frame.index];

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  const typing = !paused && !reducedMotion;
  useEffect(() => {
    if (!typing) return;
    const complete = frame.length === phrase.length && !frame.deleting;
    const timer = window.setTimeout(() => {
      if (complete) setFrame({ ...frame, deleting: true });
      else if (frame.deleting && frame.length === 0) {
        setFrame({ index: (frame.index + 1) % phrases.length, length: 0, deleting: false });
      } else {
        setFrame({ ...frame, length: frame.length + (frame.deleting ? -1 : 1) });
      }
    }, complete ? 3200 : frame.deleting ? 35 : 85);
    return () => window.clearTimeout(timer);
  }, [frame, typing, phrase, phrases.length]);

  return { text: typing ? phrase.slice(0, frame.length) : phrase, typing };
}

export function Caret({ className }: { className: string }) {
  return (
    <span
      className={`ml-0.5 inline-block animate-[nbCaret_1s_step-end_infinite] motion-reduce:animate-none ${className}`}
    />
  );
}
