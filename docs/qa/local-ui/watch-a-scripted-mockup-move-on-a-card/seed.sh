#!/bin/zsh
# Builds the scratch project for this case: card #2 shows three scripted mockups — a WebGL
# `.html`, a canvas `.tsx` and an `.html` that tries to reach the network and the board;
# card #3 shows an `.html` mockup whose script never returns.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
akb raw create --title "首页加一段会动的背景" --slug moving-hero > /dev/null
akb raw create --title "卡住的样稿" --slug frozen-mockup > /dev/null
A=$(node -e "import('$(dirname $CLI)/../dist/kanban.mjs').then(m=>console.log(m.assetsDir()))")
mkdir -p "$A/2" "$A/3"

cat > "$A/2/orbit.html" <<'HTML'
<!doctype html>
<html><head><style>body{margin:0;background:#16130f;color:#f4eee4;font:14px system-ui}
canvas{display:block;width:100%;height:220px}p{margin:8px 12px}</style></head>
<body><canvas id="c" width="600" height="220"></canvas><p id="t">WebGL：未启动</p>
<script>
const c = document.getElementById("c"), gl = c.getContext("webgl"), t = document.getElementById("t");
if (!gl) t.textContent = "WebGL：不可用";
else {
  const sh = (k, s) => { const o = gl.createShader(k); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, "attribute vec2 a;uniform float r;void main(){float c=cos(r),s=sin(r);gl_Position=vec4(a.x*c-a.y*s,(a.x*s+a.y*c)*2.7,0,1);}"));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, "precision mediump float;void main(){gl_FragColor=vec4(0.95,0.45,0.2,1);}"));
  gl.linkProgram(p); gl.useProgram(p);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0.3,-0.26,-0.15,0.26,-0.15]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(p, "a"); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const r = gl.getUniformLocation(p, "r"); let n = 0;
  (function f() { n++; gl.clearColor(0.09,0.08,0.06,1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(r, n / 30); gl.drawArrays(gl.TRIANGLES, 0, 3);
    t.textContent = "WebGL：第 " + n + " 帧"; requestAnimationFrame(f); })();
}
</script></body></html>
HTML

cat > "$A/2/meter.tsx" <<'TSX'
const draw = `
const c = document.getElementById("m"), x = c.getContext("2d"), t = document.getElementById("n");
let n = 0;
(function f() {
  n++; x.clearRect(0, 0, 600, 120);
  for (let i = 0; i < 24; i++) {
    const h = 50 + 45 * Math.sin(n / 12 + i / 2);
    x.fillStyle = "#e0672a"; x.fillRect(i * 25, 120 - h, 18, h);
  }
  t.textContent = "canvas：第 " + n + " 帧"; requestAnimationFrame(f);
})();`;

export default function Meter() {
  return (
    <div className="bg-stone-50 p-4 font-sans">
      <h1 className="text-lg font-bold text-stone-800">本周访问</h1>
      <canvas id="m" width={600} height={120} className="w-full" />
      <p id="n" className="text-sm text-stone-500">canvas：未启动</p>
      <script dangerouslySetInnerHTML={{ __html: draw }} />
    </div>
  );
}
TSX

cat > "$A/2/probe.html" <<'HTML'
<!doctype html>
<html><head><style>body{margin:0;padding:12px;font:14px/1.7 ui-monospace,monospace;background:#fff}</style>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script></head>
<body><div id="o"></div>
<script>
const o = document.getElementById("o");
const say = (k, v) => o.insertAdjacentHTML("beforeend", "<div>" + k + "：" + v + "</div>");
say("脚本", "在跑");
say("外链 three.js", typeof THREE === "undefined" ? "被拦" : "加载了");
try { say("读看板页面", parent.document.title); } catch (e) { say("读看板页面", "被拦"); }
try { localStorage.setItem("k", "v"); say("localStorage", "可写"); } catch (e) { say("localStorage", "被拦"); }
try { say("cookie", document.cookie === "" ? "空" : document.cookie); } catch (e) { say("cookie", "被拦"); }
fetch("https://example.com/").then(() => say("联网 fetch", "通了"), () => say("联网 fetch", "被拦"));
</script></body></html>
HTML

cat > "$A/3/freeze.html" <<'HTML'
<!doctype html>
<html><body style="font:14px system-ui;padding:12px">卡死前的最后一行字<script>setTimeout(() => { while (true) {} }, 500);</script></body></html>
HTML

body() { # <card file> <text>: keeps the frontmatter, writes the rest
  awk 'f < 2 { print } /^---$/ { f++ }' "$1" > "$1.new"
  cat >> "$1.new" <<CARD

$2

<!-- agent -->

## Scope

- **背景动画**：首页加一段动画。

## Todo

- [ ] 加背景动画

## Decided by the agent

### Overruled by the user
CARD
  mv "$1.new" "$1"
}
body docs/kanban/todo/2-moving-hero.md '首页顶部换成一段会动的背景。

<Asset src=".assets/2/orbit.html" label="WebGL 背景" device="desktop" />

<Asset src=".assets/2/meter.tsx" label="访问量动画" device="desktop" />

<Asset src=".assets/2/probe.html" label="越界检查" device="desktop" />'
body docs/kanban/todo/3-frozen-mockup.md '这份样稿的脚本永远不返回。

<Asset src=".assets/3/freeze.html" label="卡死的样稿" device="desktop" />'
git add -A && git commit -qm init
