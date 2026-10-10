"use client";

// The static tone shown before the shader loads and under reduced motion; it matches the
// shader's palette so the fade-in doesn't jump.
const STILL =
  "radial-gradient(60% 70% at 85% 100%, #fbe8dd 0%, transparent 70%)," +
  "radial-gradient(45% 60% at 100% 30%, #efeaf8 0%, transparent 70%), #fbf8f2";

// Starts after the page's load event so the WebGL module never competes with the first paint.
function attach(canvas: HTMLCanvasElement | null) {
  if (!canvas || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let stop: (() => void) | undefined;
  let gone = false;
  const go = () =>
    import("./hero-shader").then(({ startBackdrop }) => {
      if (!gone) stop = startBackdrop(canvas, () => (canvas.style.opacity = "1"));
    });
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
  return () => {
    gone = true;
    window.removeEventListener("load", go);
    stop?.();
  };
}

// Hero backdrop for /workflows/coding. The headline renders without it. Like `blog/Backdrop`,
// it runs up behind the site header (`-top-24`).
export function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-24 bottom-0 -z-10 overflow-hidden" style={{ background: STILL }}>
      <canvas ref={attach} className="h-full w-full opacity-0 transition-opacity duration-700" style={{ imageRendering: "pixelated" }} />
    </div>
  );
}
