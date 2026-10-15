"use client";

import { useEffect, useRef } from "react";

// Hero art for /solutions/saas, in CSS 3D. One 10s loop: a card lifts off the board, opens
// into its card page, the drafts fill in, Run is pressed, the page folds back and the card
// starts running. It waits until it scrolls into view, then tilts gently with the pointer.
// Never animate opacity or filter on anything in the 3D scene: Chrome flattens or drops it.
const CSS = `
.h3d{width:100%;container-type:inline-size;-webkit-mask-image:linear-gradient(to bottom,#000 64%,transparent);mask-image:linear-gradient(to bottom,#000 64%,transparent)}
.h3d *{box-sizing:border-box;animation-play-state:paused!important}
.h3d[data-on] *{animation-play-state:running!important}
.h3d-stage{position:relative;width:100%;aspect-ratio:9/4;perspective:1700px;perspective-origin:50% 20%;overflow:hidden}
.h3d-cam{position:absolute;left:50%;top:var(--cy,78%);width:0;height:0;transform-style:preserve-3d;--s:.74;
  transform:scale3d(var(--s),var(--s),var(--s)) rotateX(calc(56deg + var(--ty,0deg))) rotateZ(calc(-24deg + var(--tx,0deg)));transition:transform .6s cubic-bezier(.2,.7,.2,1)}
.h3d-float{transform-style:preserve-3d;animation:h3d-float 7s ease-in-out infinite}
.h3d-shadow{position:absolute;left:-360px;top:-215px;width:720px;height:450px;border-radius:120px;background:radial-gradient(closest-side,rgba(36,35,31,.16),rgba(36,35,31,.06) 70%,rgba(36,35,31,0));filter:blur(28px);transform:translateZ(-40px)}
.h3d-board{position:absolute;left:-330px;top:-205px;width:660px;height:410px;border-radius:22px;background:#fbfaf8;
  box-shadow:inset 0 0 0 1px #ece7de,0 2px 0 #e4ded3;transform-style:preserve-3d;padding:14px 16px}
.h3d-bar{display:flex;gap:6px;align-items:center;height:14px}
.h3d-dot{width:9px;height:9px;border-radius:9px}
.h3d-cols{position:absolute;left:96px;right:16px;top:44px;bottom:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;transform-style:preserve-3d}
.h3d-side{position:absolute;left:16px;top:44px;width:64px;display:flex;flex-direction:column;gap:12px}
.h3d-col{display:flex;flex-direction:column;gap:9px;transform-style:preserve-3d}
.h3d-head{height:8px;width:55%;border-radius:4px;background:#ddd6ca;margin:4px 0 4px}
.h3d-card{position:relative;height:62px;border-radius:10px;background:#fff;box-shadow:0 0 0 1px #ece7de,0 1px 2px rgba(36,35,31,.05);padding:10px}
.h3d .l{height:6px;border-radius:3px;background:#e6e0d6;margin-bottom:6px}
.h3d .l.d{background:#cfc7b9}
.h3d .l.o{background:#dd4f1e}
.h3d-lift{transform-style:preserve-3d;transform:translateZ(56px);box-shadow:0 0 0 1.5px #dd4f1e,0 18px 30px rgba(221,79,30,.18);animation:h3d-lift 10s cubic-bezier(.3,.7,.3,1) infinite}
.h3d-prog{position:absolute;left:10px;right:10px;bottom:9px;height:4px;border-radius:2px;background:#f1ece4;overflow:hidden}
.h3d-prog i{display:block;height:100%;width:0;background:#dd4f1e;animation:h3d-prog 10s linear infinite}
.h3d-slot{position:absolute;inset:0;border-radius:10px;border:1.5px dashed #e3c9bc;transform:translateZ(-56px)}
.h3d-page{position:absolute;left:50%;top:50%;width:280px;height:236px;margin-left:-140px;margin-top:-236px;border-radius:16px;background:#fff;
  box-shadow:0 0 0 1px #ece7de,0 30px 60px rgba(36,35,31,.13);padding:18px;transform-origin:50% 100%;overflow:hidden;
  transform:translate3d(62px,-30px,40px) rotateZ(24deg) rotateX(-58deg);animation:h3d-page 10s cubic-bezier(.2,.8,.2,1) infinite}
.h3d-row{display:flex;align-items:center;gap:6px}
.h3d-run{display:flex;align-items:center;justify-content:center;height:22px;width:46px;border-radius:5px;background:#dd4f1e;box-shadow:0 2px 0 #b83a12;animation:h3d-run 10s ease infinite}
.h3d-run b{width:0;height:0;border-left:6px solid #fff;border-top:4px solid transparent;border-bottom:4px solid transparent}
.h3d-sec{animation:h3d-sec 10s ease infinite}
.h3d-sec+.h3d-sec{animation-name:h3d-sec2}
.h3d-av{width:14px;height:14px;border-radius:4px;background:#fbe3d8}
.h3d-asset{border-radius:10px;padding:8px;background:#f8f5ef}
.h3d-shot{height:84px;border-radius:7px;background:#fff;box-shadow:0 1px 2px rgba(36,35,31,.06);padding:14px;justify-content:center;display:flex;flex-direction:column;align-items:center;gap:4px}
@keyframes h3d-lift{0%,8%{transform:translateZ(0);box-shadow:0 0 0 1px #ece7de}16%,74%{transform:translateZ(56px)}84%,100%{transform:translateZ(0);box-shadow:0 0 0 1.5px #dd4f1e,0 1px 2px rgba(36,35,31,.05)}}
@keyframes h3d-prog{0%,84%{width:0}100%{width:55%}}
@keyframes h3d-page{0%,14%{transform:translate3d(0,0,0) rotateZ(0) rotateX(0) scale(.01)}26%,70%{transform:translate3d(62px,-30px,40px) rotateZ(24deg) rotateX(-58deg)}80%,100%{transform:translate3d(0,0,0) rotateZ(0) rotateX(0) scale(.01)}}
@keyframes h3d-sec{0%,28%{opacity:0;transform:translateY(6px)}33%,100%{opacity:1;transform:none}}
@keyframes h3d-sec2{0%,35%{opacity:0;transform:translateY(6px)}40%,100%{opacity:1;transform:none}}
@keyframes h3d-run{0%,56%{transform:none;box-shadow:0 2px 0 #b83a12}59%{transform:translateY(2px);box-shadow:0 0 0 #b83a12}62%{transform:none;box-shadow:0 2px 0 #b83a12,0 0 0 0 rgba(221,79,30,.4)}68%,100%{box-shadow:0 2px 0 #b83a12,0 0 0 8px rgba(221,79,30,0)}}
@keyframes h3d-float{0%,100%{transform:translateZ(0) rotateZ(0)}50%{transform:translateZ(8px) rotateZ(1.5deg)}}
@container (max-width:700px){.h3d-stage{aspect-ratio:5/3}.h3d-cam{--s:.34;--cy:69%}}
@media (prefers-reduced-motion:reduce){.h3d *{animation:none!important}.h3d-cam{transition:none}}
`;

function Card({ w = ["70%", "45%"] }: { w?: string[] }) {
  return (
    <div className="h3d-card">
      <div className="l d" style={{ width: w[0] }} />
      <div className="l" style={{ width: w[1] }} />
      <div className="l" style={{ width: "30%", marginTop: 10 }} />
    </div>
  );
}

function CardPage() {
  return (
    <div className="h3d-page">
      <div className="h3d-row" style={{ justifyContent: "space-between" }}>
        <div className="l d" style={{ width: 150, margin: 0, height: 9 }} />
        <div className="h3d-run">
          <b />
        </div>
      </div>
      <div className="l" style={{ width: "88%", marginTop: 14 }} />
      <div className="l" style={{ width: "64%", marginBottom: 14 }} />
      <div className="h3d-sec h3d-asset">
        <div className="h3d-shot">
          <div className="l d" style={{ width: "50%", margin: 0, height: 7 }} />
          <div className="l" style={{ width: "34%", margin: 0 }} />
          <div className="l o" style={{ width: 34, margin: "4px 0 0", height: 9, borderRadius: 5 }} />
        </div>
      </div>
      <div className="h3d-sec h3d-row" style={{ marginTop: 12 }}>
        <div className="h3d-av" />
        <div className="l" style={{ width: 90, margin: 0 }} />
      </div>
    </div>
  );
}

export function SaasHeroArt({ label }: { label: string }) {
  const root = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    const c = cam.current;
    if (!el || !c) return;
    const start = () => el.setAttribute("data-on", "");
    if (typeof IntersectionObserver === "undefined") return start();
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      start();
      io.disconnect();
    });
    io.observe(el);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => io.disconnect();

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
      io.disconnect();
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <div ref={root} className="h3d" role="img" aria-label={label}>
        <div className="h3d-stage">
          <div ref={cam} className="h3d-cam">
            <div className="h3d-float">
              <div className="h3d-shadow" />
              <div className="h3d-board">
                <div className="h3d-bar">
                  <span className="h3d-dot" style={{ background: "#ff5f57" }} />
                  <span className="h3d-dot" style={{ background: "#febc2e" }} />
                  <span className="h3d-dot" style={{ background: "#28c840" }} />
                  <span className="l" style={{ width: 90, margin: "0 0 0 14px" }} />
                </div>
                <div className="h3d-side">
                  {[70, 55, 62, 48].map((w) => (
                    <div key={w} className="l" style={{ width: `${w}%` }} />
                  ))}
                </div>
                <div className="h3d-cols">
                  <div className="h3d-col">
                    <div className="h3d-head" />
                    <Card />
                    <Card w={["55%", "60%"]} />
                    <Card w={["65%", "35%"]} />
                  </div>
                  <div className="h3d-col">
                    <div className="h3d-head" />
                    <div style={{ position: "relative", transformStyle: "preserve-3d" }}>
                      <div className="h3d-slot" />
                      <div className="h3d-lift h3d-card">
                        <div className="l d" style={{ width: "75%" }} />
                        <div className="l" style={{ width: "50%" }} />
                        <div className="h3d-prog">
                          <i />
                        </div>
                        <CardPage />
                      </div>
                    </div>
                    <Card w={["60%", "40%"]} />
                  </div>
                  <div className="h3d-col">
                    <div className="h3d-head" />
                    <Card w={["50%", "65%"]} />
                    <Card />
                  </div>
                  <div className="h3d-col">
                    <div className="h3d-head" />
                    <Card w={["62%", "38%"]} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
