"use client";

import { useEffect, useRef, type ReactNode } from "react";

// The stage the home page's two CSS 3D scenes share, with the /solutions/saas hero's camera: it
// waits until it scrolls into view, then tilts gently with the pointer. The scene is laid out
// 600px wide and scaled to its column. A billboard (`.bb`) undoes the camera so a page or chip
// faces the viewer. On a phone a scene may crop the 4:3 stage to what it draws, moving --cy
// and the perspective origin with it so the picture stays put. Never animate opacity or filter in the scene: Chrome flattens or drops it.
const BASE_CSS = `
.s3d{width:100%;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#24231f}
.s3d *{box-sizing:border-box;animation-play-state:paused!important}
.s3d[data-on] *{animation-play-state:running!important}
.s3d-stage{position:relative;width:100%;aspect-ratio:4/3;perspective:1600px;perspective-origin:50% 20%}
.s3d-cam{position:absolute;left:var(--cx,50%);top:var(--cy,64%);width:0;height:0;transform-style:preserve-3d;--s:.86;
  transform:scale3d(calc(var(--s)*var(--k,1)),calc(var(--s)*var(--k,1)),calc(var(--s)*var(--k,1))) rotateX(calc(56deg + var(--ty,0deg))) rotateZ(calc(-24deg + var(--tx,0deg)));
  transition:transform .6s cubic-bezier(.2,.7,.2,1)}
.s3d-float{transform-style:preserve-3d;animation:s3d-float 7s ease-in-out infinite}
.s3d-shadow{position:absolute;left:-310px;top:-200px;width:620px;height:420px;border-radius:110px;background:radial-gradient(closest-side,rgba(36,35,31,.16),rgba(36,35,31,.05) 70%,rgba(36,35,31,0));filter:blur(26px);transform:translateZ(-40px)}
.s3d-board{position:absolute;left:-290px;top:-190px;width:580px;height:380px;border-radius:22px;background:#fbfaf8;
  box-shadow:inset 0 0 0 1px #ece7de,0 2px 0 #e4ded3;transform-style:preserve-3d}
.s3d-bar{position:absolute;left:16px;top:14px;display:flex;gap:6px;align-items:center}
.s3d-dot{width:9px;height:9px;border-radius:9px}
.s3d-head{position:absolute;top:46px;font-size:11px;font-weight:600;color:#a39b8d;letter-spacing:.02em}
.s3d-card{position:absolute;width:112px;height:58px;border-radius:10px;background:#fff;box-shadow:0 0 0 1px #ece7de,0 1px 2px rgba(36,35,31,.05);padding:10px;transform-style:preserve-3d}
.s3d .l{height:6px;border-radius:3px;background:#e6e0d6;margin-bottom:6px}
.s3d .l.d{background:#cfc7b9}
.s3d .bb{position:absolute;transform-origin:50% 100%}
.s3d-page{width:230px;border-radius:14px;background:#fff;box-shadow:0 0 0 1px #ece7de,0 30px 60px rgba(36,35,31,.13);padding:16px;overflow:hidden}
.s3d-chip{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:12px;background:#fff1ea;color:#c2410c;font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 0 0 1px #f6cdb9,0 8px 18px rgba(221,79,30,.18)}
.s3d-check{position:absolute;right:8px;top:8px;width:16px;height:16px;border-radius:8px;background:#dd4f1e;display:flex;align-items:center;justify-content:center}
.s3d-check:after{content:"";width:6px;height:3px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:translateY(-1px) rotate(-45deg)}
@keyframes s3d-float{0%,100%{transform:translateZ(0) rotateZ(0)}50%{transform:translateZ(8px) rotateZ(1.5deg)}}
@media (prefers-reduced-motion:reduce){.s3d *{animation:none!important}.s3d-cam{transition:none}}
`;

/** The width the scenes are laid out at. */
const WIDTH = 600;

const COLUMNS = ["Todo", "In progress", "Done"];

/** A board with its three columns; `children` are the cards and whatever moves on it. */
export function Scene3d({ label, cam, css, children }: { label: string; cam: string; css: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const camera = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    const c = camera.current;
    if (!el || !c) return;
    const fit = new ResizeObserver(() => c.style.setProperty("--k", String(el.clientWidth / WIDTH)));
    fit.observe(el);
    const start = () => el.setAttribute("data-on", "");
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      start();
      io.disconnect();
    });
    io.observe(el);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      return () => {
        fit.disconnect();
        io.disconnect();
      };

    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      c.style.setProperty("--tx", `${((e.clientX - r.left) / r.width - 0.5) * 14}deg`);
      c.style.setProperty("--ty", `${((e.clientY - r.top) / r.height - 0.5) * -10}deg`);
    };
    const leave = () => {
      c.style.setProperty("--tx", "0deg");
      c.style.setProperty("--ty", "0deg");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      fit.disconnect();
      io.disconnect();
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div ref={root} className="s3d" role="img" aria-label={label}>
      <style>{BASE_CSS + css}</style>
      <div className="s3d-stage">
        <div ref={camera} className={`s3d-cam ${cam}`}>
          <div className="s3d-float">
            <div className="s3d-shadow" />
            <div className="s3d-board">
              <div className="s3d-bar">
                <span className="s3d-dot" style={{ background: "#ff5f57" }} />
                <span className="s3d-dot" style={{ background: "#febc2e" }} />
                <span className="s3d-dot" style={{ background: "#28c840" }} />
              </div>
              {COLUMNS.map((name, k) => (
                <div key={name} className="s3d-head" style={{ left: 22 + k * 124 }}>
                  {name}
                </div>
              ))}
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A card at rest: two lines of title and a short third. */
export function Card({ x, y, w = ["70%", "45%"] }: { x: number; y: number; w?: string[] }) {
  return (
    <div className="s3d-card" style={{ left: x, top: y }}>
      <div className="l d" style={{ width: w[0] }} />
      <div className="l" style={{ width: w[1] }} />
      <div className="l" style={{ width: "30%", marginTop: 10 }} />
    </div>
  );
}
