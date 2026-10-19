"use client";

import { useEffect, useRef } from "react";
import { Mat } from "./Mat";
import type { HomeCopy } from "@/i18n/home/types";

// "AI4Kanban is the bridge", one 7s loop in three beats: an idea flies from you into the board,
// which puts out two drafts (frame around you + board); the drafts get approved; the drafts and
// their footnotes go to the agent (frame slides to board + agent). Sizes are em off a cqw font
// size, so the scene scales with its column. It moves only while in view. Reduced
// motion shows both frames at once.
const CSS = `
.br{width:100%;container-type:inline-size;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#24231f;margin:0}
.br *{box-sizing:border-box;animation-play-state:paused!important}
.br[data-on] *{animation-play-state:running!important}
.br-st{position:relative;font-size:calc(100cqw/60);height:23.5em;overflow:hidden}
.br-st>*{position:absolute}
.br-track{left:9em;right:9em;top:11em;border-top:.15em dashed #d9d1c4}
.br-tile{top:7em;width:8em;height:8em;border-radius:1.6em;background:#fff;box-shadow:0 .1em 0 #e4ded3,0 1em 2em rgba(36,35,31,.1);display:flex;align-items:center;justify-content:center}
.br-you{left:5em}
.br-agent{left:47em;background:#24231f;flex-direction:column;gap:1.1em}
.br-agent:before{content:"";position:absolute;top:-1em;left:3.6em;width:.8em;height:1em;border-radius:.4em .4em 0 0;background:#24231f}
.br-tile.br-you{flex-direction:column;gap:.35em}
.br-head{width:2.4em;height:2.4em;border-radius:50%;background:#f2c4ad}
.br-body{width:4.2em;height:2em;border-radius:2.1em 2.1em .5em .5em;background:#f7ddce}
.br-eyes{display:flex;gap:1.2em}
.br-eyes i{width:.9em;height:1.3em;border-radius:.5em;background:#fff}
.br-bar{opacity:0;animation:br-bar 7s ease infinite;width:4.4em;height:.45em;border-radius:.3em;background:rgba(255,255,255,.18);overflow:hidden}
.br-bar i{display:block;height:100%;width:0;background:#dd4f1e;animation:br-prog 7s linear infinite}
.br-board{left:22em;top:5.5em;width:16em;height:11em;border-radius:1.2em;background:#fff;box-shadow:0 .1em 0 #e4ded3,0 1.2em 2.4em rgba(36,35,31,.12);padding:1em}
.br-dots{display:flex;gap:.4em;margin-bottom:.9em}
.br-dots i{width:.6em;height:.6em;border-radius:50%;background:#e6e0d6}
.br-cols{animation:br-cols 7s ease infinite;display:grid;grid-template-columns:repeat(3,1fr);gap:.6em}
.br-col{border-radius:.5em;background:#f8f5ef;padding:.4em;height:6.8em}
.br-col i{display:block;height:1.5em;border-radius:.35em;background:#fff;box-shadow:0 0 0 .08em #ece7de;margin-bottom:.4em}
.br-name{top:16.9em;width:16em;text-align:center}
.br-name span{font-size:max(1.3em,11px);font-weight:700;letter-spacing:-.01em}
.br-frame{left:3em;top:3.6em;width:37em;height:17.8em;border-radius:2em;box-shadow:0 0 0 .22em #dd4f1e;animation:br-frame 7s cubic-bezier(.6,0,.3,1) infinite}
.br-fb{left:20em;box-shadow:none;outline:.18em dashed #dd4f1e;outline-offset:0;display:none;animation:none}
.br-chip{top:2.5em}
.br-chip span{display:flex;align-items:center;height:2.2em;padding:0 .9em;border-radius:1.1em;background:#dd4f1e;color:#fff;font-size:max(.95em,10px);font-weight:700;white-space:nowrap}
.br-ca{left:5em;animation:br-ca 7s ease infinite}
.br-cb{left:22em;opacity:0;animation:br-cb 7s ease infinite}
.br-idea{left:10.6em;top:4.4em;opacity:0;animation:br-idea 7s cubic-bezier(.5,0,.3,1) infinite}
.br-idea span{display:block;position:relative;padding:.55em .9em;border-radius:.9em;background:#fff;box-shadow:0 .5em 1.2em rgba(36,35,31,.16);font-size:max(1.1em,10px);font-weight:600;white-space:nowrap}
.br-idea span:after{content:"";position:absolute;left:1em;bottom:-.45em;width:.9em;height:.9em;background:#fff;transform:rotate(45deg);border-radius:.15em}
.br-pack{left:24.4em;top:8.4em;width:11.2em;height:6.6em;opacity:0;animation:br-pack 7s cubic-bezier(.6,0,.3,1) infinite}
.br-dr{position:absolute;top:0;width:5.2em;height:6.4em;border-radius:.6em;background:#fff;box-shadow:0 .4em 1em rgba(36,35,31,.14);padding:.5em}
.br-d1{left:0}.br-d2{left:6em}
.br-pic{height:3.4em;border-radius:.35em;background:#fbf0e9;display:flex;align-items:center;justify-content:center}
.br-pic:after{content:"";width:2.2em;height:.7em;border-radius:.35em;background:#dd4f1e}
.br-d2 .br-pic{background:#3a3631}
.br-d2 .br-pic:after{width:0;height:0;border-radius:0;background:none;border-left:.9em solid #fff;border-top:.55em solid transparent;border-bottom:.55em solid transparent;margin-left:.2em}
.br-fn{opacity:0;animation:br-note 7s ease infinite}
.br-fn i{display:block;height:.35em;border-radius:.2em;background:#e6e0d6;margin-top:.45em}
.br-fn i+i{width:60%}
.br-ok{position:absolute;right:-.5em;top:-.5em;width:1.6em;height:1.6em;border-radius:50%;background:#dd4f1e url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8.5l2.5 2.5L12 5.5' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/70% no-repeat;transform:scale(0);animation:br-ok 7s cubic-bezier(.3,1.6,.5,1) infinite}
.br-d2 .br-ok{animation-name:br-ok2}
@keyframes br-idea{0%,4%{opacity:0;transform:translateY(.6em)}8%,16%{opacity:1;transform:none}28%{opacity:1;transform:translate(16em,5em) scale(.4)}31%,100%{opacity:0;transform:translate(15.3em,4em) scale(.5)}}
@keyframes br-pack{0%,30%{opacity:0;transform:scale(.85)}36%,72%{opacity:1;transform:none}86%{opacity:1;transform:translateX(20em) scale(.55)}90%,100%{opacity:0;transform:translateX(20em) scale(.55)}}
@keyframes br-ok{0%,42%{transform:scale(0)}47%,100%{transform:scale(1)}}
@keyframes br-ok2{0%,47%{transform:scale(0)}52%,100%{transform:scale(1)}}
@keyframes br-note{0%,56%{opacity:0}63%,100%{opacity:1}}
@keyframes br-cols{0%,30%{opacity:1}34%,90%{opacity:0}95%,100%{opacity:1}}
@keyframes br-frame{0%,64%{transform:none}74%,92%{transform:translateX(17em)}100%{transform:none}}
@keyframes br-ca{0%,62%{opacity:1}66%,95%{opacity:0}100%{opacity:1}}
@keyframes br-cb{0%,70%{opacity:0;transform:translateX(17em)}74%,92%{opacity:1;transform:translateX(17em)}96%,100%{opacity:0;transform:translateX(17em)}}
@keyframes br-bar{0%,84%{opacity:0}87%,95%{opacity:1}99%,100%{opacity:0}}
@keyframes br-prog{0%,86%{width:0}97%{width:100%}100%{width:0}}
@media (prefers-reduced-motion:reduce){
.br *{animation:none!important}
.br-pack,.br-fn{opacity:1}.br-cols{opacity:0}.br-ok{transform:none}.br-idea{display:none}
.br-frame{top:4.2em;height:16.6em}.br-fb{display:block;top:3em;height:19em}
.br-cb{opacity:1;transform:none;left:39em;top:1.9em}.br-ca{top:3.1em}}
`;


export function BridgeScene({ c }: { c: HomeCopy["handoff"]["scene"] }) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => el.toggleAttribute("data-on", !!entry?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <figure ref={root} className="br" role="img" aria-label={c.label}>
      <style>{CSS}</style>
      <Mat wash="peachEmber">
        <div className="br-st">
          <div className="br-track" />
          <div className="br-frame br-fb" />
          <div className="br-frame" />
          <div className="br-tile br-you"><div className="br-head" /><div className="br-body" /></div>
          <div className="br-board">
            <div className="br-dots"><i /><i /><i /></div>
            <div className="br-cols">
              <div className="br-col"><i /><i /></div>
              <div className="br-col"><i /></div>
              <div className="br-col"><i /><i /><i /></div>
            </div>
          </div>
          <div className="br-tile br-agent">
            <div className="br-eyes"><i /><i /></div>
            <div className="br-bar"><i /></div>
          </div>
          <div className="br-name" style={{ left: "1em" }}><span>{c.you}</span></div>
          <div className="br-name" style={{ left: "22em" }}><span>{c.board}</span></div>
          <div className="br-name" style={{ left: "43em" }}><span>{c.agent}</span></div>
          <div className="br-idea"><span>{c.idea}</span></div>
          <div className="br-pack">
            <div className="br-dr br-d1">
              <div className="br-pic" />
              <div className="br-fn"><i /><i /></div>
              <span className="br-ok" />
            </div>
            <div className="br-dr br-d2">
              <div className="br-pic" />
              <div className="br-fn"><i /><i /></div>
              <span className="br-ok" />
            </div>
          </div>
          <div className="br-chip br-ca"><span>{c.review}</span></div>
          <div className="br-chip br-cb"><span>{c.build}</span></div>
        </div>
      </Mat>
    </figure>
  );
}
