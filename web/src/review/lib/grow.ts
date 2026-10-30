import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties, type MutableRefObject } from "react";

const FADE = 20;

function fade(top: boolean, bottom: boolean): CSSProperties | undefined {
  if (!top && !bottom) return undefined;
  const head = top ? `transparent 0, rgba(0,0,0,0.3) ${FADE / 2}px, #000 ${FADE}px` : "#000 0";
  const tail = bottom ? `#000 calc(100% - ${FADE}px), rgba(0,0,0,0.3) calc(100% - ${FADE / 2}px), transparent 100%` : "#000 100%";
  const m = `linear-gradient(to bottom, ${head}, ${tail})`;
  return { maskImage: m, WebkitMaskImage: m };
}

/** A textarea that grows with `value` up to its CSS max-height, then scrolls with the hidden
 *  edge faded. `keep` also receives the element. */
export function useGrowingBox(value: string, keep?: MutableRefObject<HTMLTextAreaElement | null>) {
  const [el, setEl] = useState<HTMLTextAreaElement | null>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const ref = useCallback(
    (node: HTMLTextAreaElement | null) => {
      if (keep) keep.current = node;
      setEl(node);
    },
    [keep],
  );
  const measure = useCallback(() => {
    if (!el) return;
    const top = el.scrollTop > 0;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdges((e) => (e.top === top && e.bottom === bottom ? e : { top, bottom }));
  }, [el]);
  const fit = useCallback(() => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    measure();
  }, [el, measure]);

  useLayoutEffect(fit, [fit, value]);
  useEffect(() => {
    if (!el) return;
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => watch.disconnect();
  }, [el, fit]);

  return { ref, onScroll: measure, style: fade(edges.top, edges.bottom) };
}
