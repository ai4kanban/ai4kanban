import { Card, Scene3d } from "./Scene3d";

// One 10s loop: the running card finishes and slides to Done; a follow-up card rises out of it,
// arcs back to Todo and waits; the user presses Accept. The words are English in every locale.
const CSS = `
.f-cam{--cx:48%;--cy:44%;--s:.94}
.f-cam .s3d-board{left:-200px;width:400px}
.f-cam .s3d-shadow{left:-230px;width:460px}
.f-run{left:144px;top:68px;animation:f-run 10s cubic-bezier(.4,0,.2,1) infinite}
.f-prog{position:absolute;left:10px;right:10px;bottom:9px;height:4px;border-radius:2px;background:#f1ece4;overflow:hidden}
.f-prog i{display:block;height:100%;width:0;background:#dd4f1e;animation:f-prog 10s linear infinite}
.f-done{animation:f-done 10s ease infinite}
.f-new{left:0;top:0;width:150px;height:auto;padding:12px;box-shadow:0 0 0 1.5px #dd4f1e,0 18px 30px rgba(221,79,30,.18);animation:f-new 10s cubic-bezier(.45,.05,.4,1) infinite}
.f-dash{position:absolute;inset:0;border-radius:10px;border:1.5px dashed #dd4f1e;background:#fff}
.f-body{position:relative}
.f-kicker{font-size:10px;font-weight:700;color:#c2410c;letter-spacing:.04em;text-transform:uppercase;margin-bottom:6px}
.f-name{font-size:12px;font-weight:600;line-height:1.3;margin-bottom:10px}
.f-btns{display:flex;gap:6px}
.f-btn{height:22px;padding:0 9px;border-radius:6px;font-size:11px;font-weight:600;display:flex;align-items:center}
.f-acc{background:#dd4f1e;color:#fff;box-shadow:0 2px 0 #b83a12;animation:f-acc 10s ease infinite}
.f-dis{background:#f1ece4;color:#7a7266}
.f-ok{animation:f-ok 10s ease infinite}
.f-slot{position:absolute;left:20px;top:68px;width:150px;height:96px;border-radius:10px;border:1.5px dashed #e3c9bc;animation:f-slot 10s ease infinite}
@keyframes f-prog{0%,4%{width:0}30%,100%{width:100%}}
@keyframes f-run{0%,32%{transform:translate3d(0,0,0) scale(1)}37%{transform:translate3d(62px,0,36px) scale(1)}42%,90%{transform:translate3d(124px,0,0) scale(1)}94%{transform:translate3d(124px,0,0) scale(.01)}95%{transform:translate3d(0,0,0) scale(.01)}100%{transform:translate3d(0,0,0) scale(1)}}
@keyframes f-done{0%,40%,94%,100%{transform:scale(.01)}44%,90%{transform:scale(1)}}
@keyframes f-new{0%,46%{transform:translate3d(268px,68px,0) scale(.01)}50%{transform:translate3d(268px,68px,30px) scale(.6)}57%{transform:translate3d(144px,68px,90px) scale(1)}64%,74%{transform:translate3d(20px,68px,34px) scale(1.08)}80%,90%{transform:translate3d(20px,68px,0) scale(1)}95%,100%{transform:translate3d(20px,68px,0) scale(.01)}}
@keyframes f-acc{0%,72%{transform:none;box-shadow:0 2px 0 #b83a12}75%{transform:translateY(2px);box-shadow:0 0 0 #b83a12}78%{transform:none;box-shadow:0 2px 0 #b83a12,0 0 0 0 rgba(221,79,30,.4)}86%,100%{box-shadow:0 2px 0 #b83a12,0 0 0 8px rgba(221,79,30,0)}}
@keyframes f-ok{0%,77%{transform:scale(.01)}80%,92%{transform:scale(1)}96%,100%{transform:scale(.01)}}
@keyframes f-slot{0%,56%,96%,100%{transform:scale(.01)}60%,78%{transform:scale(1)}80%,94%{transform:scale(.01)}}
@media (prefers-reduced-motion:reduce){.f-run{transform:translate3d(124px,0,0)}.f-prog i{width:100%}.f-new{transform:translate3d(20px,68px,0)}.f-slot,.f-ok{transform:scale(0)}}
`;

export function FollowUpsScene({ label }: { label: string }) {
  return (
    <Scene3d label={label} cam="f-cam" css={CSS}>
      <div className="f-slot" />
      <Card x={20} y={178} w={["55%", "60%"]} />
      <Card x={20} y={248} w={["65%", "35%"]} />
      <Card x={144} y={138} w={["62%", "38%"]} />
      <Card x={268} y={138} w={["50%", "65%"]} />
      <Card x={268} y={208} />

      <div className="s3d-card f-run">
        <div className="l d" style={{ width: "75%" }} />
        <div className="l" style={{ width: "50%" }} />
        <div className="f-prog">
          <i />
        </div>
        <div className="s3d-check f-done" />
      </div>

      <div className="s3d-card f-new">
        <div className="f-dash" />
        <div className="f-body">
          <div className="f-kicker">Follow-up</div>
          <div className="f-name">Add a test for the empty state</div>
          <div className="f-btns">
            <div className="f-btn f-acc">Accept</div>
            <div className="f-btn f-dis">Dismiss</div>
          </div>
        </div>
        <div className="s3d-check f-ok" />
      </div>
    </Scene3d>
  );
}
