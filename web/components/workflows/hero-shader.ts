// Pixel backdrop for the /workflows/coding hero: a board seen in perspective. Kanban lanes run
// to a horizon and cards glide along them toward the viewer, over a dithered haze, all drawn at
// 1/PX resolution. The centre column above the horizon stays quiet for the headline. Loaded on
// demand by HeroBackdrop; returns a stop function.

const PX = 5;
const FPS = 24;

const VERT = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_t;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { return 0.55 * noise(p) + 0.3 * noise(p * 2.03 + 7.1) + 0.15 * noise(p * 4.1 + 3.3); }

float bayer(vec2 c) {
  vec2 a = mod(c, 4.0);
  float m = mod(a.x, 2.0) * 2.0 + mod(a.y, 2.0) * 3.0 - 4.0 * mod(a.x, 2.0) * mod(a.y, 2.0);
  vec2 b = floor(a / 2.0);
  float n = mod(b.x, 2.0) * 2.0 + mod(b.y, 2.0) * 3.0 - 4.0 * mod(b.x, 2.0) * mod(b.y, 2.0);
  return (m * 4.0 + n + 0.5) / 16.0;
}

vec3 BASE = vec3(0.984, 0.973, 0.949);
vec3 PEACH = vec3(0.965, 0.808, 0.718);
vec3 LILAC = vec3(0.871, 0.835, 0.949);
vec3 EMBER = vec3(0.925, 0.510, 0.325);
vec3 LINE = vec3(0.918, 0.890, 0.855);

void main() {
  vec2 c = floor(gl_FragCoord.xy);
  vec2 uv = c / u_res;
  float aspect = u_res.x / u_res.y;
  float d = bayer(c);
  float horizon = 0.42;

  // Sky: slow dithered haze, thinning toward the centre where the headline sits.
  vec2 q = vec2(uv.x * aspect, uv.y) * 2.0;
  float t = u_t * 0.03;
  float haze = fbm(q + vec2(t, -t * 0.5));
  float centre = smoothstep(0.12, 0.55, abs(uv.x - 0.5) * 1.6 + max(0.0, horizon - uv.y));
  vec3 col = BASE;
  float hz = clamp((haze - 0.5) * 2.0, 0.0, 1.0) * mix(0.35, 1.0, centre);
  if (hz > d) col = fbm(q * 0.6 + 9.0) > 0.5 ? mix(BASE, PEACH, 0.45) : mix(BASE, LILAC, 0.5);

  if (uv.y < horizon) {
    // Floor: project the pixel onto a plane; z grows toward the horizon.
    float h = horizon - uv.y;
    float z = 0.35 / h;
    float x = (uv.x - 0.5) * aspect * z * 3.2 + 0.5;
    float fog = smoothstep(7.0, 1.2, z);

    float lane = floor(x);
    float lx = fract(x);
    float speed = 0.35 + 0.5 * hash(vec2(lane, 3.0));
    float zz = z + u_t * speed + hash(vec2(lane, 9.0)) * 10.0;
    float slot = floor(zz / 1.6);
    float sz = fract(zz / 1.6);

    // Lane rails and cross ties, thinner with distance.
    float w = 0.035 * z;
    if (lx < w || lx > 1.0 - w || fract(z * 0.5 + u_t * 0.1) < 0.02 * z) col = mix(col, LINE, fog);

    // One card per slot, sometimes none; a few glow ember.
    float r = hash(vec2(lane, slot));
    bool card = r > 0.45 && lx > 0.14 && lx < 0.86 && sz > 0.15 && sz < 0.75;
    if (card) {
      vec3 face = r > 0.95 ? mix(EMBER, BASE, 0.25) : r > 0.7 ? PEACH : LILAC;
      bool edge = lx < 0.14 + w * 1.5 || lx > 0.86 - w * 1.5 || sz < 0.15 + 0.05 || sz > 0.75 - 0.05;
      vec3 cc = edge ? mix(face, vec3(0.141, 0.137, 0.122), 0.25) : face;
      // A title bar on near cards: two pixel rows of a darker tint.
      if (!edge && sz > 0.6 && sz < 0.66 && lx < 0.6 && z < 4.0) cc = mix(face, vec3(0.141, 0.137, 0.122), 0.18);
      if (fog > d * 0.9) col = cc;
    }
    // Keep the floor's centre near the horizon light so the framed visual reads.
    col = mix(col, BASE, (1.0 - centre) * 0.35);
  }

  float spark = step(0.996, hash(c + floor(u_t * 0.8) * 13.0)) * centre * step(horizon, uv.y);
  if (spark > 0.5) col = hash(c) > 0.5 ? EMBER : vec3(0.733, 0.663, 0.902);
  gl_FragColor = vec4(col, 1.0);
}`;

export function startBackdrop(canvas: HTMLCanvasElement, onFirstFrame: () => void): () => void {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
  if (!gl) return () => {};

  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return () => {};
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, "u_res");
  const uT = gl.getUniformLocation(prog, "u_t");

  const resize = () => {
    canvas.width = Math.max(1, Math.ceil(canvas.clientWidth / PX));
    canvas.height = Math.max(1, Math.ceil(canvas.clientHeight / PX));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  };
  resize();

  // A random start so a reload doesn't always open on the same frame.
  let clock = Math.random() * 600;
  let last = 0;
  let raf = 0;
  let seen = true;
  let first = true;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / FPS) return;
    clock += last ? Math.min(now - last, 100) / 1000 : 0;
    last = now;
    gl.uniform1f(uT, clock);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (first) {
      first = false;
      onFirstFrame();
    }
  };
  const run = () => {
    cancelAnimationFrame(raf);
    last = 0;
    if (seen && !document.hidden) raf = requestAnimationFrame(frame);
  };

  const io = new IntersectionObserver(([e]) => {
    seen = e.isIntersecting;
    run();
  });
  io.observe(canvas);
  // Resizing clears the canvas; redraw now so a paused backdrop doesn't go blank.
  const ro = new ResizeObserver(() => {
    resize();
    gl.uniform1f(uT, clock);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  });
  ro.observe(canvas);
  document.addEventListener("visibilitychange", run);
  run();

  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", run);
  };
}
