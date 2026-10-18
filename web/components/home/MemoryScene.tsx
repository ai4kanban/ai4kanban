import { Card, Scene3d } from "./Scene3d";

// One 12s loop: card A opens into its page, the user leaves a note on the draft, the note drops
// into the memory stack and card A is done; card B opens and the note comes back out of the
// stack into B's draft, already applied. The words are English in every locale.
const CSS = `
.m-cam{--cx:49%;--cy:52%;--s:.72}
.m-stack{position:absolute;left:400px;top:62px;width:160px;height:200px;transform-style:preserve-3d}
.m-sheet{position:absolute;inset:0;border-radius:12px;background:#fff;box-shadow:0 0 0 1px #ece7de,0 1px 2px rgba(36,35,31,.06)}
.m-top{padding:14px;transform:translateZ(24px)}
.m-top b{display:block;font-size:12px;font-weight:600;color:#7a7266;margin-bottom:12px}
.m-top .l{height:8px;border-radius:4px}
.m-new{height:8px;border-radius:4px;background:#dd4f1e;width:0;animation:m-new 12s ease infinite}
.m-pulse{position:absolute;inset:-1px;border-radius:12px;animation:m-pulse 12s ease infinite}
.m-liftA{animation:m-liftA 12s cubic-bezier(.3,.7,.3,1) infinite}
.m-liftB{animation:m-liftB 12s cubic-bezier(.3,.7,.3,1) infinite}
.m-pageA{left:-59px;top:-200px;height:200px;animation:m-pageA 12s cubic-bezier(.2,.8,.2,1) infinite}
.m-pageB{left:-59px;top:-200px;height:200px;animation:m-pageB 12s cubic-bezier(.2,.8,.2,1) infinite}
.m-note{margin-top:12px;transform-origin:0 50%;animation:m-note 12s ease infinite}
.m-fly1{left:0;top:0;animation:m-fly1 12s cubic-bezier(.45,.05,.4,1) infinite}
.m-fly2{left:0;top:0;animation:m-fly2 12s cubic-bezier(.45,.05,.4,1) infinite}
.m-applied{transform-origin:0 50%;animation:m-pop 12s ease infinite}
.m-doneA{animation:m-doneA 12s ease infinite}
.m-title{font-size:13px;font-weight:600;margin-bottom:12px}
.m-draft{border-radius:9px;background:#f8f5ef;padding:10px}
.m-draft p{margin:0 0 6px;font-size:12px;font-weight:600;line-height:1.3}
.m-hl{border-radius:4px;box-shadow:0 0 0 1.5px #dd4f1e;padding:1px 4px;margin:-1px -4px}
.m-tag{display:inline-block;margin-top:10px;font-size:11px;font-weight:600;color:#c2410c}
.m-saved{transform-origin:0 50%;animation:m-saved 12s ease infinite}
@keyframes m-saved{0%,46%,94%,100%{transform:translateY(4px) scale(.01)}50%,90%{transform:none}}
@keyframes m-new{0%,44%{width:0}50%,94%{width:70%}100%{width:0}}
@keyframes m-pulse{0%,42%,50%,62%,72%,100%{box-shadow:0 0 0 0 rgba(221,79,30,0)}46%,66%{box-shadow:0 0 0 2px #dd4f1e}}
@keyframes m-liftA{0%,5%,56%,100%{transform:translateZ(0)}11%,50%{transform:translateZ(40px)}}
@keyframes m-liftB{0%,56%,100%{transform:translateZ(0)}62%,93%{transform:translateZ(40px)}}
@keyframes m-pageA{0%,8%,54%,100%{transform:translate3d(0,0,0) rotateZ(24deg) rotateX(-58deg) scale(.01)}16%,46%{transform:translate3d(0,0,10px) rotateZ(24deg) rotateX(-58deg) scale(1)}}
@keyframes m-pageB{0%,58%,96%,100%{transform:translate3d(0,0,0) rotateZ(24deg) rotateX(-58deg) scale(.01)}66%,90%{transform:translate3d(0,0,10px) rotateZ(24deg) rotateX(-58deg) scale(1)}}
@keyframes m-note{0%,20%{transform:translateY(6px) scale(.01)}24%,100%{transform:none}}
@keyframes m-fly1{0%,29%{transform:translate3d(110px,110px,120px) rotateZ(24deg) rotateX(-58deg) scale(.01)}31%{transform:translate3d(110px,110px,120px) rotateZ(24deg) rotateX(-58deg) scale(1)}43%{transform:translate3d(440px,150px,40px) rotateZ(24deg) rotateX(-58deg) scale(1)}45%,100%{transform:translate3d(440px,150px,30px) rotateZ(24deg) rotateX(-58deg) scale(.01)}}
@keyframes m-fly2{0%,66%{transform:translate3d(440px,150px,30px) rotateZ(24deg) rotateX(-58deg) scale(.01)}68%{transform:translate3d(440px,150px,40px) rotateZ(24deg) rotateX(-58deg) scale(1)}78%{transform:translate3d(240px,110px,120px) rotateZ(24deg) rotateX(-58deg) scale(1)}80%,100%{transform:translate3d(240px,110px,120px) rotateZ(24deg) rotateX(-58deg) scale(.01)}}
@keyframes m-pop{0%,78%{transform:translateY(4px) scale(.01)}82%,100%{transform:none}}
@keyframes m-doneA{0%,54%,100%{transform:scale(.01)}58%,96%{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.m-pageB{transform:translate3d(0,0,10px) rotateZ(24deg) rotateX(-58deg)}.m-liftB{transform:translateZ(40px)}.m-new{width:70%}.m-pageA,.m-fly1,.m-fly2,.m-doneA{transform:scale(0)}}
`;

function Chip() {
  return <div className="s3d-chip">Shorter titles</div>;
}

export function MemoryScene({ label }: { label: string }) {
  return (
    <Scene3d label={label} cam="m-cam" css={CSS}>
      <div className="s3d-card m-liftA" style={{ left: 20, top: 68 }}>
        <div className="l d" style={{ width: "75%" }} />
        <div className="l" style={{ width: "50%" }} />
        <div className="s3d-check m-doneA" />
        <div className="bb s3d-page m-pageA">
          <div className="m-title">Blog post: launch</div>
          <div className="m-draft">
            <p>Introducing AI4Kanban: an agent workspace for indie hackers</p>
            <div className="l" style={{ width: "90%" }} />
            <div className="l" style={{ width: "70%" }} />
          </div>
          <div className="m-note">
            <Chip />
          </div>
        </div>
      </div>
      <Card x={20} y={138} w={["55%", "60%"]} />
      <Card x={20} y={208} w={["65%", "35%"]} />

      <div className="s3d-card m-liftB" style={{ left: 144, top: 68 }}>
        <div className="l d" style={{ width: "60%" }} />
        <div className="l" style={{ width: "40%" }} />
        <div className="bb s3d-page m-pageB">
          <div className="m-title">Blog post: pricing</div>
          <div className="m-draft">
            <p>
              <span className="m-hl">Pricing, simplified</span>
            </p>
            <div className="l" style={{ width: "90%" }} />
            <div className="l" style={{ width: "70%" }} />
          </div>
          <div className="m-applied">
            <span className="m-tag">✓ Applied from memory</span>
          </div>
        </div>
      </div>
      <Card x={144} y={138} w={["62%", "38%"]} />

      <div className="s3d-card" style={{ left: 268, top: 68 }}>
        <div className="l d" style={{ width: "75%" }} />
        <div className="l" style={{ width: "50%" }} />
      </div>
      <Card x={268} y={138} w={["50%", "65%"]} />

      <div className="m-stack">
        <div className="m-sheet" style={{ transform: "translateZ(8px)" }} />
        <div className="m-sheet" style={{ transform: "translateZ(16px)" }} />
        <div className="m-sheet m-top">
          <b>Memory</b>
          <div className="l d" style={{ width: "80%" }} />
          <div className="l" style={{ width: "60%" }} />
          <div className="l" style={{ width: "72%" }} />
          <div className="l" style={{ width: "50%" }} />
          <div className="m-new" />
          <span className="m-tag m-saved">✓ Remembered</span>
          <div className="m-pulse" />
        </div>
      </div>

      <div className="bb m-fly1">
        <Chip />
      </div>
      <div className="bb m-fly2">
        <Chip />
      </div>
    </Scene3d>
  );
}
