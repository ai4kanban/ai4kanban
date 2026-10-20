// The agents' pixel art: every sprite is drawn here, pixel by pixel, on a 48x48 canvas.
// `node kanban-ui/character-design/draw.mjs` rewrites `png/`, the loop videos, the product
// avatars in `public/agent-art/` (and the site's), and the office's `run-scene/cast.*`.
// README.md is the spec.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const S = 48;
const INK = "#0b0a09";

const ramp = (l, b, s, d = s) => ({ l, b, s, d });
const C = {
  body: ramp("#3b3733", "#24211f", "#161413"),
  visor: ramp("#ffffff", "#f6f2e6", "#d9d0bb", "#b9ae96"),
  eye: "#3fa87a",
  eyeL: "#a6e3c0",
  ember: ramp("#ff8a5c", "#f4511e", "#b83a12", "#7d2709"),
  navy: ramp("#4f86b8", "#2c5c86", "#1f4466", "#152f47"),
  mint: ramp("#c4ead2", "#7fca9c", "#4f9d70", "#2f6b46"),
  lilac: ramp("#d4c6f0", "#b199e0", "#8a6fc4", "#5a3f92"),
  peach: ramp("#f6c3a6", "#ec9a72", "#c06f47", "#8a4a28"),
  sand: ramp("#efe3c4", "#d9c9a3", "#b8a57c", "#8c7a55"),
  sky: "#7fb4e0",
  wood: "#a8733e",
  steel: "#4a433d",
};
const flat = (c) => ({ l: c, b: c, s: c, d: c });

class Sprite {
  constructor() {
    this.px = new Array(S * S).fill(null);
    this.dx = 0;
    this.dy = 0;
  }
  get(x, y) {
    return x < 0 || y < 0 || x >= S || y >= S ? null : this.px[y * S + x];
  }
  set(x, y, c) {
    x += this.dx;
    y += this.dy;
    if (c && x >= 0 && y >= 0 && x < S && y < S) this.px[y * S + x] = c;
  }
  clear(x, y) {
    x += this.dx;
    y += this.dy;
    if (x >= 0 && y >= 0 && x < S && y < S) this.px[y * S + x] = null;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  fill(mask, r) {
    const has = (x, y) => mask.has(`${x},${y}`);
    for (const k of mask) {
      const [x, y] = k.split(",").map(Number);
      if (typeof r === "string") this.set(x, y, r);
      else if (!has(x, y + 1) || !has(x + 1, y)) this.set(x, y, r.s);
      else if (!has(x, y - 1) || !has(x - 1, y)) this.set(x, y, r.l);
      else this.set(x, y, r.b);
    }
  }
  blob(x, y, w, h, r, rad = 2) {
    const m = new Set();
    const t = (rad - 0.5) ** 2;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const ci = Math.min(i, w - 1 - i);
        const cj = Math.min(j, h - 1 - j);
        if (ci < rad && cj < rad && (rad - 0.5 - ci) ** 2 + (rad - 0.5 - cj) ** 2 > t) continue;
        m.add(`${x + i},${y + j}`);
      }
    this.fill(m, r);
  }
  shape(y0, spans, r) {
    const m = new Set();
    spans.forEach(([a, b], j) => {
      for (let x = a; x <= b; x++) m.add(`${x},${y0 + j}`);
    });
    this.fill(m, r);
  }
  line(x0, y0, x1, y1, c, w = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      this.rect(x, y, w, w, c);
    }
  }
  // A thick line filled as one lit part.
  stroke(x0, y0, x1, y1, w, r) {
    const m = new Set();
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      for (let j = 0; j < w; j++) for (let k = 0; k < w; k++) m.add(`${x + k},${y + j}`);
    }
    this.fill(m, r);
  }
  mirror() {
    const out = new Array(S * S).fill(null);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) out[y * S + (S - 1 - x)] = this.px[y * S + x];
    this.px = out;
  }
  inked(draw) {
    const part = new Sprite();
    part.dx = this.dx;
    part.dy = this.dy;
    draw(part);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        if (!part.get(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => part.get(x + a, y + b)))
          this.px[y * S + x] = INK;
    part.px.forEach((c, i) => c && (this.px[i] = c));
  }
  outline() {
    const out = this.px.slice();
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        if (!this.get(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => this.get(x + a, y + b)))
          out[y * S + x] = INK;
    this.px = out;
    return this;
  }
}

// --- the shared robot ------------------------------------------------------------

function antenna(sp) {
  sp.rect(23, 4, 2, 4, C.body.l);
  sp.blob(22, 1, 4, 3, C.ember, 1);
}

const EYES = {
  focused: (sp) => {
    sp.rect(18, 14, 3, 2, C.eye);
    sp.rect(27, 14, 3, 2, C.eye);
    sp.rect(18, 13, 3, 1, C.visor.s);
    sp.rect(27, 13, 3, 1, C.visor.s);
  },
  happy: (sp) => {
    for (const x of [18, 26]) {
      sp.set(x, 15, C.eye);
      sp.rect(x + 1, 14, 2, 1, C.eye);
      sp.set(x + 3, 15, C.eye);
    }
    sp.rect(16, 17, 2, 1, C.peach.b);
    sp.rect(30, 17, 2, 1, C.peach.b);
  },
};

function faceFront(sp, eyes) {
  sp.blob(16, 11, 16, 9, C.visor, 2);
  sp.rect(17, 12, 2, 1, C.visor.l);
  EYES[eyes](sp);
}

function faceSide(sp, eyes) {
  sp.blob(27, 11, 8, 9, C.visor, 2);
  sp.set(28, 12, C.visor.l);
  if (eyes === "focused") sp.rect(31, 14, 3, 2, C.eye);
  else {
    sp.set(31, 15, C.eye);
    sp.rect(32, 14, 2, 1, C.eye);
  }
}

function bodyFront(sp, { hands = 33, arms = true, head = 0 } = {}) {
  const dy = sp.dy;
  sp.dy = dy + head;
  antenna(sp);
  sp.blob(13, 8, 22, 15, C.body, 3);
  sp.dy = dy;
  sp.rect(21, 23, 6, 1, C.body.s);
  sp.blob(15, 24, 18, 13, C.body, 2);
  for (const [s, w, h] of arms ? [[12, 12, 11], [33, 34, 33]] : []) {
    sp.blob(s, 25, 3, 3, C.body, 1);
    sp.rect(w, 28, 2, hands - 28, C.body.b);
    sp.blob(h, hands, 4, 3, C.body, 1);
  }
  for (const [l, f] of [[18, 16], [26, 25]]) {
    sp.rect(l, 37, 4, 5, C.body.b);
    sp.rect(l + 3, 37, 1, 5, C.body.s);
    sp.blob(f, 42, 7, 4, C.body, 2);
  }
}

function bodyBack(sp, opts) {
  bodyFront(sp, opts);
  for (const y of [14, 16, 18]) sp.rect(20, y, 8, 1, C.body.s);
}

// Profile facing right. `far` draws the far arm between the legs and the torso.
function bodySide(sp, { legs = [21, 21], lift = [0, 0], far } = {}) {
  const [near, farLeg] = legs;
  const dy = sp.dy;
  sp.dy = 0;
  const leg = (x, up, r) => {
    sp.line(21, 36, x, 39 - up, r.b, 4);
    sp.blob(x - 1, 42 - up, 8, 4, r, 2);
  };
  leg(farLeg, lift[1], flat(C.body.s));
  leg(near, lift[0], C.body);
  sp.dy = dy;
  if (far) sp.inked(far);
  antenna(sp);
  sp.blob(15, 8, 19, 15, C.body, 3);
  sp.rect(19, 14, 3, 3, C.body.l);
  sp.set(20, 15, C.body.s);
  sp.rect(21, 23, 6, 1, C.body.s);
  sp.blob(17, 24, 14, 13, C.body, 2);
}

function armSide(sp, { hand = [22, 33], sleeve }) {
  sp.inked((a) => {
    const [hx, hy] = hand;
    sleeve(a, hx, hy);
    a.blob(hx, hy, 4, 3, C.body, 1);
  });
}

// Back view at the desk, arms left to the costume: head (nodding), seams, torso, legs.
function bodyWork(sp, { head = 0 } = {}) {
  bodyFront(sp, { arms: false, head });
  const dy = sp.dy;
  sp.dy = dy + head;
  for (const y of [14, 16, 18]) sp.rect(20, y, 8, 1, C.body.s);
  sp.dy = dy;
}

// Front view on the sofa: the head and torso drop six rows, thighs come toward the viewer
// and the feet end on the ground line like a standing sprite.
const SIT = 6;
function bodySit(sp, { arms = true } = {}) {
  sp.dy = SIT;
  antenna(sp);
  sp.blob(13, 8, 22, 15, C.body, 3);
  sp.dy = 0;
  sp.rect(21, 29, 6, 1, C.body.s);
  sp.blob(15, 30, 18, 9, C.body, 2);
  for (const x of [14, 25]) {
    sp.blob(x, 36, 9, 6, C.body, 2);
    sp.blob(x + 1, 41, 7, 5, C.body, 2);
    sp.rect(x + 2, 44, 5, 1, C.body.l);
  }
  for (const [s, w, h] of arms ? [[12, 12, 11], [33, 34, 33]] : []) {
    sp.blob(s, 31, 3, 3, C.body, 1);
    sp.rect(w, 34, 2, 3, C.body.b);
    sp.blob(h, 37, 4, 3, C.body, 1);
  }
}

// A typing arm on the viewer's left, seen from behind: elbow out, fist up beside the
// chest. `up` lifts a striking hand two rows. Mirror the part for the other side.
function typingArm(a, up, upper) {
  const hy = 26 - up * 2;
  upper(a, [7, 30 - up], hy);
  a.blob(8, hy, 4, 3, C.body, 1);
}

// --- the walk ---------------------------------------------------------------------
// Four frames: stride, pass, stride, pass. A foot on the ground moves back 5px a frame, so
// the sprite walks without sliding when it travels 5px a frame. Arms swing against the legs.

const WALK = [
  { legs: [26, 16], lift: [0, 0], near: [18, 33], far: [28, 33], bob: 0 },
  { legs: [21, 19], lift: [0, 2], near: [22, 34], far: [22, 34], bob: -1 },
  { legs: [16, 26], lift: [0, 0], near: [27, 33], far: [15, 33], bob: 0 },
  { legs: [19, 21], lift: [2, 0], near: [22, 34], far: [22, 34], bob: -1 },
];

// --- builder: mint hood up, hoodie, pocket, ribbed hem ------------------------------

const builder = {
  hem(sp, x0, x1) {
    for (let x = x0; x <= x1; x++) sp.rect(x, 36, 1, 2, x % 2 ? C.mint.d : C.mint.s);
  },
  sleeves(sp) {
    for (const x of [10, 33]) {
      sp.inked((s) => {
        s.shape(24, [[x + 2, x + 4], ...Array(8).fill([x, x + 4])], C.mint);
        for (let i = x; i <= x + 4; i++) s.rect(i, 32, 1, 2, i % 2 ? C.mint.d : C.mint.s);
        s.blob(x + 1, 34, 4, 3, C.body, 1);
      });
    }
  },
  mug(sp, x, y) {
    sp.inked((m) => {
      m.rect(x, y, 4, 5, C.visor.b);
      m.rect(x + 3, y, 1, 5, C.visor.s);
      m.rect(x, y + 1, 4, 1, C.ember.b);
      m.rect(x + 4, y + 1, 1, 3, C.visor.s);
    });
  },
  front(sp, { prop = true } = {}) {
    bodyFront(sp, { hands: 34 });
    sp.blob(11, 6, 26, 18, C.mint, 4);
    sp.blob(13, 8, 22, 16, C.mint.d, 3);
    sp.blob(14, 9, 20, 14, C.body.b, 3);
    faceFront(sp, "focused");
    sp.shape(23, [...Array(13).fill([14, 33])], C.mint);
    builder.hem(sp, 14, 33);
    sp.shape(30, [[20, 27], [19, 28], [18, 29], [18, 29], [18, 29]], { l: C.mint.d, b: C.mint.s, s: C.mint.s });
    for (const x of [19, 28]) {
      sp.rect(x, 23, 1, 5, C.visor.b);
      sp.set(x, 28, C.visor.s);
    }
    builder.sleeves(sp);
    if (prop) {
      builder.mug(sp, 34, 32);
      sp.set(35, 30, C.visor.s);
      sp.set(36, 29, C.visor.s);
      sp.inked((h) => h.blob(34, 34, 4, 3, C.body, 1));
    }
  },
  side(sp, { prop = true } = {}) {
    bodySide(sp);
    sp.blob(13, 6, 21, 18, C.mint, 4);
    sp.shape(20, [[12, 16], [12, 16], [13, 17], [14, 18], [15, 18]], C.mint);
    sp.blob(24, 8, 10, 15, C.mint.d, 2);
    sp.blob(25, 9, 9, 13, C.body.b, 2);
    faceSide(sp, "focused");
    sp.shape(23, Array(13).fill([16, 31]), C.mint);
    builder.hem(sp, 16, 31);
    sp.shape(30, [[28, 30], [27, 31], [27, 31], [27, 31], [27, 31]], { l: C.mint.d, b: C.mint.s, s: C.mint.s });
    sp.rect(30, 23, 1, 5, C.visor.b);
    armSide(sp, {
      hand: [22, 34],
      sleeve: (a) => {
        a.shape(24, [[22, 25], ...Array(7).fill([21, 25])], C.mint);
        for (let i = 21; i <= 25; i++) a.rect(i, 32, 1, 2, i % 2 ? C.mint.d : C.mint.s);
      },
    });
    if (prop) {
      builder.mug(sp, 25, 32);
      sp.set(26, 30, C.visor.s);
      sp.set(27, 29, C.visor.s);
    }
  },
  back(sp, { prop = true } = {}) {
    bodyBack(sp, { hands: 34 });
    sp.shape(23, Array(13).fill([14, 33]), C.mint);
    builder.hem(sp, 14, 33);
    sp.blob(11, 6, 26, 18, C.mint, 4);
    sp.shape(22, [[16, 31], [17, 30], [18, 29], [20, 27]], C.mint);
    sp.rect(23, 8, 2, 17, C.mint.s);
    sp.rect(23, 8, 1, 17, C.mint.d);
    sp.rect(27, 29, 3, 3, C.ember.b);
    sp.set(28, 30, C.visor.b);
    builder.sleeves(sp);
    if (prop) sp.inked((m) => m.rect(9, 32, 2, 4, C.visor.b));
  },
  // A sleeve from the shoulder to a hand at (hx, hy): straight down, or angled for a swing.
  arm(a, [hx, hy], far) {
    const r = far ? flat(C.mint.s) : C.mint;
    if (!far) a.blob(21, 24, 5, 4, C.mint, 1);
    if (hx === 22) a.shape(25, Array(hy - 27).fill([21, 25]), r);
    else a.stroke(hx < 22 ? 21 : 22, 26, hx, hy - 4, 4, r);
    for (let i = hx; i <= hx + 3; i++) a.rect(i, hy - 2, 1, 2, far ? C.mint.d : i % 2 ? C.mint.d : C.mint.s);
    a.blob(hx, hy, 4, 3, far ? flat(C.body.s) : C.body, 1);
  },
  walk(sp, step) {
    const w = WALK[step];
    const pass = w.bob !== 0;
    sp.dy = w.bob;
    bodySide(sp, { ...w, far: (a) => builder.arm(a, w.far, true) });
    // The hood's point lags a row when the body rises.
    const t = pass ? 1 : 0;
    sp.blob(13, 6, 21, 18, C.mint, 4);
    sp.shape(20 + t, [[12, 16], [12, 16], [13, 17], [14, 18], [15, 18]], C.mint);
    sp.blob(24, 8, 10, 15, C.mint.d, 2);
    sp.blob(25, 9, 9, 13, C.body.b, 2);
    faceSide(sp, "focused");
    sp.shape(23, Array(13).fill([16, 31]), C.mint);
    builder.hem(sp, 16, 31);
    sp.shape(30, [[28, 30], [27, 31], [27, 31], [27, 31], [27, 31]], { l: C.mint.d, b: C.mint.s, s: C.mint.s });
    // Drawstring: hangs a row longer on the rise, swings back on a stride.
    if (pass) sp.rect(30, 23, 1, 6, C.visor.b);
    else {
      sp.rect(30, 23, 1, 3, C.visor.b);
      sp.rect(29, 26, 1, 2, C.visor.b);
    }
    sp.inked((a) => builder.arm(a, w.near, false));
    sp.dy = 0;
  },
  // Typing at the office desk, seen from behind. Hands strike in turn; the head nods on
  // the rests and the hood follows it.
  work(sp, step) {
    const hands = [[1, 0], [0, 0], [0, 1], [0, 0]][step];
    const nod = step % 2;
    bodyWork(sp, { head: nod });
    sp.shape(23, Array(13).fill([14, 33]), C.mint);
    builder.hem(sp, 14, 33);
    sp.dy = nod;
    sp.blob(11, 6, 26, 18, C.mint, 4);
    sp.rect(23, 8, 2, 16, C.mint.s);
    sp.rect(23, 8, 1, 16, C.mint.d);
    sp.dy = 0;
    // The hood drapes on the shoulders; its fold deepens as the head nods.
    sp.shape(22 + nod, [[16, 31], [17, 30], [18, 29], [20, 27]], C.mint);
    sp.rect(23, 23 + nod, 2, 2, C.mint.s);
    sp.rect(27, 29, 3, 3, C.ember.b);
    sp.set(28, 30, C.visor.b);
    hands.forEach((up, side) =>
      sp.inked((s) => {
        typingArm(s, up, (a, [ex, ey], hy) => {
          a.stroke(11, 24, ex, ey, 4, C.mint);
          a.stroke(ex, ey, 8, hy + 2, 4, C.mint);
          for (let i = 8; i <= 11; i++) a.rect(i, hy + 2, 1, 2, i % 2 ? C.mint.d : C.mint.s);
        });
        if (side) s.mirror();
      }),
    );
  },
  sit(sp) {
    bodySit(sp, { arms: false });
    sp.dy = SIT;
    sp.blob(11, 6, 26, 18, C.mint, 4);
    sp.blob(13, 8, 22, 16, C.mint.d, 3);
    sp.blob(14, 9, 20, 14, C.body.b, 3);
    faceFront(sp, "focused");
    sp.dy = 0;
    // The hoodie bunches on the lap: its ribbed hem lies across the thighs.
    sp.shape(29, [...Array(8).fill([14, 33]), [13, 34]], C.mint);
    for (let x = 13; x <= 34; x++) sp.rect(x, 37, 1, 2, x % 2 ? C.mint.d : C.mint.s);
    sp.shape(32, [[20, 27], [19, 28], [18, 29], [18, 29]], { l: C.mint.d, b: C.mint.s, s: C.mint.s });
    for (const x of [19, 28]) {
      sp.rect(x, 29, 1, 3, C.visor.b);
      sp.set(x, 32, C.visor.s);
    }
    for (const x of [10, 33]) {
      sp.inked((s) => {
        s.shape(30, [[x + 2, x + 4], ...Array(5).fill([x, x + 4])], C.mint);
        for (let i = x; i <= x + 4; i++) s.rect(i, 35, 1, 2, i % 2 ? C.mint.d : C.mint.s);
        s.blob(x + 1, 37, 4, 3, C.body, 1);
      });
    }
  },
};

// --- ui-designer: ember beret, lilac smock, cream apron -------------------------------

const uiDesigner = {
  beret(sp, flip) {
    const rows = [[16, 30], [13, 34], [12, 36], [12, 37], [13, 37], [33, 37]];
    sp.shape(5, flip ? rows.map(([a, b]) => [47 - b, 47 - a]) : rows, C.ember);
  },
  smock: [[16, 31], ...Array(10).fill([15, 32]), [14, 33], [14, 33], [14, 33], [14, 33]],
  sleeves(sp) {
    for (const x of [10, 33]) sp.inked((s) => s.blob(x, 24, 5, 6, C.lilac, 2));
  },
  brush(sp, x0, y0, x1, y1) {
    sp.inked((b) => {
      b.line(x0, y0, x1, y1, C.wood);
      b.rect(x0, y0 - 1, 1, 1, C.steel);
      b.rect(x0, y0 - 3, 1, 2, C.ember.b);
    });
  },
  front(sp, { prop = true } = {}) {
    bodyFront(sp);
    faceFront(sp, "happy");
    uiDesigner.beret(sp);
    sp.rect(16, 11, 16, 1, C.visor.s);
    sp.shape(23, uiDesigner.smock, C.lilac);
    sp.rect(18, 24, 2, 2, C.visor.b);
    sp.rect(28, 24, 2, 2, C.visor.b);
    sp.inked((a) => {
      a.rect(18, 26, 12, 12, C.visor.b);
      a.rect(29, 26, 1, 12, C.visor.s);
      a.rect(20, 32, 8, 3, C.visor.s);
      a.set(21, 30, C.wood);
      a.set(21, 29, C.ember.b);
      a.set(24, 31, C.wood);
      a.set(24, 30, C.sky);
      a.rect(19, 27, 2, 1, C.mint.b);
      a.set(27, 29, C.sky);
      a.rect(25, 36, 2, 1, C.peach.b);
    });
    sp.shape(23, [[21, 26], [22, 25], [23, 24]], C.peach);
    uiDesigner.sleeves(sp);
    if (prop) uiDesigner.brush(sp, 35, 24, 35, 35);
    if (prop) sp.inked((h) => h.blob(33, 33, 4, 3, C.body, 1));
  },
  side(sp, { prop = true } = {}) {
    bodySide(sp);
    faceSide(sp, "happy");
    sp.shape(5, [[17, 30], [14, 33], [13, 35], [13, 35], [14, 34]], C.ember);
    sp.rect(27, 11, 8, 1, C.visor.s);
    sp.inked((n) => {
      n.line(18, 24, 14, 28, C.peach.b, 2);
      n.set(14, 29, C.peach.s);
    });
    sp.shape(23, [[18, 29], ...Array(10).fill([17, 30]), [16, 31], [16, 31], [16, 31], [16, 31]], C.lilac);
    sp.inked((a) => {
      a.rect(30, 26, 2, 12, C.visor.b);
      a.rect(28, 23, 2, 3, C.visor.b);
      a.set(31, 29, C.ember.b);
      a.set(31, 30, C.wood);
    });
    sp.rect(29, 23, 2, 2, C.peach.b);
    armSide(sp, {
      sleeve: (a) => {
        a.blob(20, 24, 6, 6, C.lilac, 2);
        a.rect(23, 30, 2, 3, C.body.l);
      },
    });
    if (prop) uiDesigner.brush(sp, 24, 24, 24, 35);
    if (prop) sp.inked((h) => h.blob(22, 33, 4, 3, C.body, 1));
  },
  back(sp, { prop = true } = {}) {
    bodyBack(sp);
    uiDesigner.beret(sp, true);
    sp.shape(23, uiDesigner.smock, C.lilac);
    uiDesigner.apronBack(sp, 0);
    uiDesigner.sleeves(sp);
    if (prop) sp.inked((b) => b.line(12, 24, 12, 31, C.wood));
  },
  // Crossed straps and the bow; `sway` swings the bow's tails.
  apronBack(sp, sway) {
    sp.line(18, 24, 28, 34, C.visor.b);
    sp.line(29, 24, 19, 34, C.visor.b);
    sp.shape(23, [[19, 28], [20, 27], [21, 26], [22, 25], [23, 24]], C.peach);
    sp.inked((b) => {
      b.shape(34, [[19, 21], [19, 22], [19, 21]], C.visor);
      b.shape(34, [[26, 28], [25, 28], [26, 28]], C.visor);
      b.rect(23, 35, 2, 1, C.visor.s);
      b.rect(21, 37, 1, 2, C.visor.b);
      b.rect(21 + sway, 39, 1, 1, C.visor.b);
      b.rect(26, 37, 1, 2, C.visor.b);
      b.rect(26 + sway, 39, 1, 1, C.visor.b);
    });
    sp.rect(17, 28, 2, 1, C.sky);
  },
  arm(a, [hx, hy], far) {
    if (!far) a.blob(20, 24, 6, 6, C.lilac, 2);
    a.line(23, 29, hx + 1, hy - 1, far ? C.body.s : C.body.l, 2);
    a.blob(hx, hy, 4, 3, far ? flat(C.body.s) : C.body, 1);
  },
  walk(sp, step) {
    const w = WALK[step];
    const pass = w.bob !== 0;
    sp.dy = w.bob;
    bodySide(sp, { ...w, far: (a) => uiDesigner.arm(a, w.far, true) });
    faceSide(sp, "happy");
    // The beret's back brim sags a row on the rise.
    sp.shape(5, [[17, 30], [14, 33], [13, 35], [13, 35], [14, 34], ...(pass ? [[13, 16]] : [])], C.ember);
    sp.rect(27, 11, 8, 1, C.visor.s);
    // Scarf tail streams back on a stride and drops on the rise.
    sp.inked((n) => {
      if (pass) {
        n.line(18, 24, 15, 28, C.peach.b, 2);
        n.set(15, 30, C.peach.s);
      } else {
        n.line(18, 24, 13, 27, C.peach.b, 2);
        n.set(12, 28, C.peach.s);
      }
    });
    // The smock's hem flares back on a stride, like the planner's coat tail.
    const t = pass ? 0 : 1;
    sp.shape(23, [[18, 29], ...Array(10).fill([17, 30]), [16, 31], [16 - t, 31], [15 - t, 31], [15 - t, 31]], C.lilac);
    // The apron's lower edge kicks forward when the near knee comes through.
    const kick = step === 0 ? 1 : 0;
    sp.inked((a) => {
      a.rect(30, 26, 2, 9, C.visor.b);
      a.rect(30 + kick, 35, 2, 3, C.visor.b);
      a.rect(28, 23, 2, 3, C.visor.b);
      a.set(31, 29, C.ember.b);
      a.set(31, 30, C.wood);
    });
    sp.rect(29, 23, 2, 2, C.peach.b);
    sp.inked((a) => uiDesigner.arm(a, w.near, false));
    sp.dy = 0;
  },
  // Typing at the office desk, seen from behind: the beret tips with the head, the bow's
  // tails swing as the shoulders work.
  work(sp, step) {
    const hands = [[0, 1], [0, 0], [1, 0], [0, 0]][step];
    const tilt = step === 1 || step === 2 ? 1 : 0;
    bodyWork(sp, { head: tilt });
    sp.shape(23, uiDesigner.smock, C.lilac);
    uiDesigner.apronBack(sp, step < 2 ? 0 : 1);
    sp.dy = tilt;
    uiDesigner.beret(sp, true);
    if (tilt) sp.shape(10, [[10, 13]], C.ember);
    sp.dy = 0;
    hands.forEach((up, side) =>
      sp.inked((s) => {
        typingArm(s, up, (a, [ex, ey], hy) => {
          a.blob(10, 24, 5, 6, C.lilac, 2);
          a.line(11, 29, ex, ey, C.body.l, 2);
          a.line(ex, ey, 9, hy + 2, C.body.l, 2);
        });
        if (side) s.mirror();
      }),
    );
  },
  sit(sp) {
    bodySit(sp, { arms: false });
    sp.dy = SIT;
    faceFront(sp, "happy");
    uiDesigner.beret(sp);
    sp.rect(16, 11, 16, 1, C.visor.s);
    sp.dy = 0;
    // The smock flares over the lap; the apron ends on the knees.
    sp.shape(29, [[16, 31], ...Array(6).fill([15, 32]), [14, 33], [13, 34], [13, 34]], C.lilac);
    sp.rect(18, 30, 2, 2, C.visor.b);
    sp.rect(28, 30, 2, 2, C.visor.b);
    sp.inked((a) => {
      a.rect(18, 32, 12, 8, C.visor.b);
      a.rect(29, 32, 1, 8, C.visor.s);
      a.rect(18, 39, 12, 1, C.visor.s);
      a.set(21, 34, C.ember.b);
      a.set(24, 35, C.sky);
      a.rect(19, 33, 2, 1, C.mint.b);
      a.set(27, 36, C.lilac.d);
    });
    sp.shape(29, [[21, 26], [22, 25], [23, 24]], C.peach);
    for (const x of [10, 33]) {
      sp.inked((s) => {
        s.blob(x, 30, 5, 6, C.lilac, 2);
        s.rect(x + 2, 35, 2, 2, C.body.l);
        s.blob(x + 1, 37, 4, 3, C.body, 1);
      });
    }
  },
};

// --- base: the plain robot custom agents share, with a name badge on the left upper arm --
// The badge is a blank cream patch; the name's first visible character is laid over it at
// runtime, so every custom agent shares these frames. Facing the viewer the robot's left
// arm is on the right; from behind, on the left. In profile the patch rides the near arm so
// it still shows, and facing left mirrors it.

const BADGE = 7;
const badge = (sp, x, y) =>
  sp.inked((b) => b.blob(x, y, BADGE, BADGE, C.visor, 2));
// The patch's top-left per pose, in sprite pixels; the walk's rises one row on a pass.
const BADGE_AT = { front: [31, 23], back: [10, 23], side: [20, 23], walk: [20, 23], work: [7, 23], sit: [31, 29] };

const base = {
  front(sp) {
    bodyFront(sp);
    faceFront(sp, "focused");
    badge(sp, ...BADGE_AT.front);
  },
  side(sp) {
    bodySide(sp);
    faceSide(sp, "focused");
    armSide(sp, { sleeve: (a) => a.rect(23, 25, 2, 8, C.body.l) });
    badge(sp, ...BADGE_AT.side);
  },
  back(sp) {
    bodyBack(sp);
    badge(sp, ...BADGE_AT.back);
  },
  walk(sp, step) {
    const w = WALK[step];
    sp.dy = w.bob;
    const arm = (far) => (a) => {
      const [hx, hy] = far ? w.far : w.near;
      a.line(23, 26, hx + 1, hy - 1, far ? C.body.s : C.body.l, 2);
      a.blob(hx, hy, 4, 3, far ? flat(C.body.s) : C.body, 1);
    };
    bodySide(sp, { ...w, far: arm(true) });
    faceSide(sp, "focused");
    sp.inked(arm(false));
    badge(sp, ...BADGE_AT.walk);
    sp.dy = 0;
  },
  work(sp, step) {
    const hands = [[1, 0], [0, 0], [0, 1], [0, 0]][step];
    bodyWork(sp, { head: step % 2 });
    hands.forEach((up, side) =>
      sp.inked((s) => {
        typingArm(s, up, (a, [ex, ey], hy) => {
          a.blob(12, 24, 3, 3, C.body, 1);
          a.line(12, 26, ex, ey, C.body.l, 2);
          a.line(ex, ey, 9, hy + 2, C.body.l, 2);
        });
        if (side) s.mirror();
      }),
    );
    badge(sp, ...BADGE_AT.work);
  },
  sit(sp) {
    bodySit(sp);
    sp.dy = SIT;
    faceFront(sp, "focused");
    sp.dy = 0;
    badge(sp, ...BADGE_AT.sit);
  },
};

// --- the design screen ------------------------------------------------------------------
// The desk's display shows a design canvas instead of code: the same 76×42 rectangle
// `layout.json` names, four frames in step with the desk's own 250 ms loop. A cursor drags a
// selection across the artboard. Only the display's dark interior is painted.

const SCREEN = { x: 105, y: 19, w: 76, h: 42 };
function designScreen(step) {
  const px = new Array(SCREEN.w * SCREEN.h).fill(null);
  const rect = (x, y, w, h, c) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px[j * SCREEN.w + i] = c;
  };
  rect(1, 1, 74, 39, "#0a1f15");
  rect(2, 3, 4, 34, "#12301f");
  for (const [y, c] of [[5, C.ember.b], [10, C.mint.b], [15, C.sky], [20, C.lilac.b]]) rect(3, y, 2, 2, c);
  rect(66, 3, 8, 34, "#12301f");
  for (let i = 0; i < 6; i++) rect(67, 5 + i * 4, i % 2 ? 4 : 6, 1, "#4f9d70");
  // The artboard: a header, a hero block, two cards and text lines.
  rect(10, 4, 52, 32, C.visor.b);
  rect(10, 4, 52, 4, C.ember.b);
  rect(13, 11, 22, 10, C.mint.l);
  rect(38, 11, 20, 2, C.sand.d);
  rect(38, 15, 16, 1, C.sand.d);
  rect(38, 18, 12, 1, C.sand.d);
  rect(13, 24, 14, 9, C.lilac.l);
  rect(30, 24, 14, 9, C.sand.b);
  rect(47, 24, 12, 9, C.sky);
  // The selection grows toward the cursor, then lets go.
  const box = [[13, 24, 14, 9], [13, 24, 20, 9], [13, 24, 26, 10], [30, 24, 14, 9]][step];
  const [bx, by, bw, bh] = box;
  for (let i = bx - 1; i <= bx + bw; i++) {
    px[(by - 1) * SCREEN.w + i] = C.sky;
    px[(by + bh) * SCREEN.w + i] = C.sky;
  }
  for (let j = by - 1; j <= by + bh; j++) {
    px[j * SCREEN.w + bx - 1] = C.sky;
    px[j * SCREEN.w + bx + bw] = C.sky;
  }
  const [cx, cy] = [bx + bw, by + bh];
  for (let j = 0; j < 4; j++) rect(cx, cy + j, j + 1, 1, "#ffffff");
  return { px, w: SCREEN.w, h: SCREEN.h };
}

// --- the outfits ---------------------------------------------------------------------
// Front and back of every other built-in job on the shared body. Costume only, no hand
// props. Hats leave the antenna tip on top.

EYES.calm = (sp) => {
  sp.rect(19, 14, 2, 3, C.eye);
  sp.rect(27, 14, 2, 3, C.eye);
};

const R = {
  brass: ramp("#f6d58a", "#e3ac3f", "#a8741f", "#7a5414"),
  khaki: ramp("#e6d3a0", "#c8ab6c", "#9a7d44", "#6b5329"),
  brown: ramp("#b98552", "#8e5a2f", "#6b4220", "#4a2c14"),
  gray: ramp("#cfcac1", "#a19b91", "#746f67", "#4d4943"),
  teal: ramp("#a3e0d6", "#4fb3a5", "#2f8578", "#1d5a51"),
  wine: ramp("#d97a86", "#b23a48", "#842636", "#5a1724"),
  yellow: ramp("#ffe68a", "#f5c63c", "#c9961e", "#8f6a10"),
  sky: ramp("#bcdaf2", "#7fb4e0", "#4f86b8", "#2c5c86"),
  ink: ramp("#55504a", "#2e2a27", "#1c1a18", "#121110"),
  white: ramp("#ffffff", "#f6f2e6", "#d9d0bb", "#b9ae96"),
};
const shadeOf = (r) => ({ l: r.b, b: r.s, s: r.d });
const tip = (sp) => sp.blob(22, 1, 4, 3, C.ember, 1);

// A garment from the neck down to row y1; rows past the hips flare out by up to `flare`.
function top(sp, r, { y0 = 23, y1 = 36, x0 = 14, x1 = 33, flare = 0 } = {}) {
  const rows = [];
  for (let y = y0; y <= y1; y++) {
    const f = y > 36 ? Math.min(flare, y - 36) : 0;
    rows.push([x0 - f, x1 + f]);
  }
  sp.shape(y0, rows, r);
}

// Sleeves over the wire arms to a cuff on row y1. `short` stops at the elbow; `bell` widens.
function sleeves(sp, r, { y1 = 33, cuff, short = false, bell = false, roll } = {}) {
  for (const [x, first] of [[10, [12, 14]], [33, [33, 35]]]) {
    sp.inked((s) => {
      const end = short ? 28 : y1;
      const rows = [first];
      for (let y = 25; y <= end; y++) {
        const w = bell ? Math.max(0, Math.min(2, Math.floor((y - 28) / 2))) : 0;
        rows.push([x - (x === 10 ? w : 0), x + 4 + (x === 33 ? w : 0)]);
      }
      s.shape(24, rows, r);
      if (cuff) s.rect(x, end, 5, 1, cuff);
      if (roll) s.rect(x, end - 1, 5, 2, roll);
      if (!short) s.blob(x + 1, end + 1, 4, 3, C.body, 1);
    });
  }
}

const vee = (sp, c, depth = 4, y = 23) =>
  sp.shape(y, [[20, 27], [21, 26], [22, 25], [23, 24]].slice(0, depth), c);
const split = (sp, y0, y1) => {
  for (let y = y0; y <= y1; y++) for (const x of [23, 24]) sp.clear(x, y);
};
const dots = (sp, pts, c) => pts.forEach(([x, y]) => sp.set(x, y, c));
// Pants over the legs: overalls, coveralls and scrubs colour them.
function pants(sp, r) {
  for (const l of [18, 26]) sp.shape(37, Array(5).fill([l, l + 3]), r);
}

// Each role: name, Chinese label, head / body / back notes, and its front and back.
const ROLES = [];
const role = (name, zh, eyes, notes, front, back, custom = false) =>
  ROLES.push({ name, zh, eyes, notes, front, back, custom });

// software-planner — the reviewed planner direction: captain's cap, navy coat, map tube.
role(
  "software-planner", "软件规划", "focused",
  ["白顶船长帽", "海军蓝双排扣大衣、金肩章", "斜背地图筒"],
  (sp) => {
    top(sp, C.navy, { y1: 39, flare: 1 });
    split(sp, 37, 39);
    vee(sp, C.visor.b);
    sp.rect(23, 25, 2, 3, C.ember.b);
    for (const y of [29, 32, 35]) dots(sp, [[20, y], [27, y]], R.brass.l);
    sleeves(sp, C.navy, { cuff: R.brass.b });
    sp.shape(23, [[12, 16], [11, 16], [11, 16]], R.brass);
    sp.shape(23, [[31, 35], [31, 36], [31, 36]], R.brass);
    sp.shape(5, [[14, 33], [12, 35], [12, 35]], C.visor);
    sp.rect(13, 8, 22, 2, C.navy.b);
    sp.rect(13, 8, 22, 1, C.navy.l);
    sp.rect(15, 10, 18, 1, C.navy.d);
    sp.rect(22, 6, 4, 1, R.brass.b);
  },
  (sp) => {
    top(sp, C.navy, { y1: 39, flare: 1 });
    split(sp, 34, 39);
    sleeves(sp, C.navy, { cuff: R.brass.b });
    sp.shape(23, [[12, 16], [11, 16], [11, 16]], R.brass);
    sp.shape(23, [[31, 35], [31, 36], [31, 36]], R.brass);
    sp.inked((t) => {
      t.stroke(32, 20, 15, 37, 3, C.sand);
      t.rect(31, 19, 4, 2, C.ember.b);
    });
    sp.shape(5, [[14, 33], [12, 35], [12, 35]], C.visor);
    sp.rect(13, 8, 22, 2, C.navy.b);
    sp.rect(13, 8, 22, 1, C.navy.l);
  },
);

// blog-planner — editor in chief: straw boater, seersucker blazer, tie, back vent.
const boater = (sp) => {
  sp.shape(5, Array(4).fill([16, 31]), C.sand);
  for (let x = 17; x <= 30; x += 3) sp.set(x, 6, C.sand.s);
  sp.rect(16, 7, 16, 2, C.navy.b);
  sp.shape(9, [[10, 37], [11, 36]], C.sand);
};
role(
  "blog-planner", "博客主编", "focused",
  ["平顶硬草帽、藏青帽带", "芥黄竖条泡泡纱西装、领带", "背后中缝开衩"],
  (sp) => {
    top(sp, R.yellow);
    for (let x = 15; x <= 32; x += 2) sp.rect(x, 25, 1, 11, R.yellow.l);
    vee(sp, C.visor.b);
    sp.rect(23, 24, 2, 7, C.ember.b);
    sp.rect(23, 31, 2, 1, C.ember.s);
    dots(sp, [[22, 32], [22, 35]], C.navy.d);
    sleeves(sp, R.yellow, { cuff: R.yellow.s });
    boater(sp);
  },
  (sp) => {
    top(sp, R.yellow);
    for (let x = 15; x <= 32; x += 2) sp.rect(x, 25, 1, 11, R.yellow.l);
    sp.rect(23, 30, 1, 7, R.yellow.d);
    sp.rect(15, 23, 18, 1, R.yellow.s);
    sleeves(sp, R.yellow, { cuff: R.yellow.s });
    boater(sp);
  },
);

// blog-researcher — field researcher: pith helmet, safari jacket, backpack.
const pith = (sp) => {
  sp.shape(3, [[21, 26], [18, 29], [16, 31], [15, 32], [14, 33], [14, 33]], R.khaki);
  sp.rect(14, 9, 20, 1, R.brown.b);
  sp.shape(10, [[11, 36], [12, 35]], R.khaki);
};
role(
  "blog-researcher", "博客调研", "focused",
  ["卡其探险遮阳盔", "四贴袋猎装、腰带", "双肩背包"],
  (sp) => {
    top(sp, R.khaki);
    sp.rect(14, 30, 20, 2, R.brown.b);
    sp.rect(23, 30, 2, 2, R.brass.b);
    for (const x of [16, 27]) {
      sp.rect(x, 25, 5, 3, R.khaki.s);
      sp.rect(x, 25, 5, 1, R.khaki.d);
      sp.rect(x, 33, 5, 3, R.khaki.s);
      sp.rect(x, 33, 5, 1, R.khaki.d);
    }
    vee(sp, R.khaki.d, 2);
    sp.rect(15, 23, 2, 8, R.brown.s);
    sp.rect(31, 23, 2, 8, R.brown.s);
    sleeves(sp, R.khaki, { roll: R.khaki.s, y1: 31 });
    pith(sp);
  },
  (sp) => {
    top(sp, R.khaki);
    sp.rect(14, 30, 20, 2, R.brown.b);
    sleeves(sp, R.khaki, { roll: R.khaki.s, y1: 31 });
    sp.inked((b) => {
      b.blob(16, 23, 16, 13, R.brown, 3);
      b.rect(17, 24, 14, 4, R.brown.s);
      b.rect(23, 27, 2, 2, R.brass.b);
      b.rect(19, 31, 10, 3, R.brown.l);
    });
    pith(sp);
  },
);

// blog-illustrator — sketcher: knotted bandana, denim overalls over a cream shirt.
role(
  "blog-illustrator", "博客配图", "happy",
  ["侧结红头巾", "牛仔背带裤、奶白衬衫", "背带交叉、后袋插铅笔"],
  (sp) => {
    top(sp, C.visor);
    sleeves(sp, C.visor, { roll: C.visor.s, y1: 31 });
    sp.shape(28, Array(9).fill([16, 31]), R.sky);
    pants(sp, R.sky);
    for (const x of [17, 29]) sp.rect(x, 23, 2, 6, R.sky.s);
    dots(sp, [[18, 28], [29, 28]], R.brass.b);
    sp.rect(20, 30, 8, 3, R.sky.s);
    dots(sp, [[18, 34], [26, 32], [29, 35], [21, 39]], C.ember.b);
    dots(sp, [[24, 35], [28, 38]], C.mint.b);
    sp.shape(6, [[18, 29], [15, 32], [14, 33], [13, 34], [13, 34]], C.ember);
    dots(sp, [[17, 8], [21, 7], [26, 8], [30, 9], [19, 10], [24, 10]], C.visor.b);
    sp.inked((k) => {
      k.blob(32, 6, 4, 4, C.ember, 1);
      k.shape(10, [[34, 36], [35, 37], [35, 37], [36, 37]], C.ember);
    });
  },
  (sp) => {
    top(sp, C.visor);
    sleeves(sp, C.visor, { roll: C.visor.s, y1: 31 });
    sp.shape(30, Array(7).fill([16, 31]), R.sky);
    pants(sp, R.sky);
    sp.line(17, 23, 28, 30, R.sky.s, 2);
    sp.line(30, 23, 19, 30, R.sky.s, 2);
    sp.rect(18, 32, 5, 4, R.sky.s);
    sp.inked((p) => {
      p.rect(26, 29, 2, 6, R.yellow.b);
      p.rect(26, 28, 2, 1, C.peach.b);
    });
    sp.rect(26, 32, 4, 4, R.sky.s);
    sp.shape(6, [[18, 29], [15, 32], [14, 33], [13, 34], [13, 34]], C.ember);
    dots(sp, [[17, 8], [21, 7], [26, 8], [30, 9], [19, 10], [24, 10]], C.visor.b);
    sp.inked((k) => {
      k.blob(21, 9, 6, 4, C.ember, 1);
      k.shape(13, [[20, 22], [20, 22], [19, 21], [19, 21]], C.ember);
      k.shape(13, [[25, 27], [25, 27], [26, 28]], C.ember);
    });
  },
);

// illustrator — painter: wide straw hat, knee-length smock with patch pockets, back board.
const straw = (sp) => {
  sp.shape(4, [[19, 28], [18, 29], [17, 30], [17, 30], [17, 30]], C.sand);
  sp.rect(17, 7, 14, 2, C.peach.b);
  sp.shape(9, [[9, 38], [7, 40]], C.sand);
  sp.shape(11, [[7, 9]], C.sand);
  sp.shape(11, [[38, 40]], C.sand);
  for (let x = 10; x <= 38; x += 3) sp.set(x, 10, C.sand.s);
};
role(
  "illustrator", "插画", "happy",
  ["宽檐草帽、蜜桃丝带", "及膝蜜桃罩衫、两只大贴袋", "斜背画板"],
  (sp) => {
    top(sp, C.peach, { y1: 40, flare: 1 });
    split(sp, 38, 40);
    sp.shape(23, [[18, 29], [19, 28]], C.visor);
    for (const x of [16, 26]) {
      sp.rect(x, 31, 6, 5, C.peach.l);
      sp.rect(x, 31, 6, 1, C.peach.s);
    }
    dots(sp, [[18, 27], [29, 26], [27, 38]], C.lilac.b);
    dots(sp, [[20, 26], [17, 38]], R.sky.b);
    sleeves(sp, C.peach, { cuff: C.peach.s });
    straw(sp);
  },
  (sp) => {
    top(sp, C.peach, { y1: 40, flare: 1 });
    sleeves(sp, C.peach, { cuff: C.peach.s });
    sp.inked((b) => {
      b.shape(25, Array(10).fill([17, 30]), R.khaki);
      b.rect(17, 25, 14, 1, R.brown.b);
      b.rect(19, 28, 6, 4, C.visor.b);
      b.set(20, 29, C.lilac.b);
      b.set(23, 30, R.sky.b);
    });
    sp.line(14, 23, 33, 25, R.brown.s, 1);
    straw(sp);
  },
);

// carousel-planner — social poster: backward ember cap, breton tee, crossbody bag.
role(
  "carousel-planner", "社交帖子", "happy",
  ["反戴余烬橙棒球帽", "海魂横条长袖 T 恤", "帽舌朝后、斜挎小包"],
  (sp) => {
    top(sp, C.visor);
    for (let y = 25; y <= 35; y += 3) sp.rect(14, y, 20, 1, C.navy.b);
    sleeves(sp, C.visor, { cuff: C.navy.b });
    sp.line(14, 24, 30, 33, C.ember.s, 1);
    sp.inked((b) => {
      b.blob(27, 31, 7, 5, C.ember, 1);
      b.rect(28, 32, 5, 1, C.ember.d);
    });
    sp.shape(5, [[18, 29], [16, 31], [15, 32], [14, 33], [14, 33], [13, 34]], C.ember);
    sp.rect(21, 9, 6, 2, C.body.l);
    sp.rect(21, 10, 6, 1, C.ember.d);
  },
  (sp) => {
    top(sp, C.visor);
    for (let y = 25; y <= 35; y += 3) sp.rect(14, y, 20, 1, C.navy.b);
    sleeves(sp, C.visor, { cuff: C.navy.b });
    sp.line(33, 24, 17, 33, C.ember.s, 1);
    sp.shape(5, [[18, 29], [16, 31], [15, 32], [14, 33], [14, 33], [13, 34]], C.ember);
    sp.inked((b) => b.shape(10, [[15, 32], [14, 33], [16, 31]], shadeOf(C.ember)));
  },
);

// competitor-research — detective: deerstalker with ear flaps, belted trench, storm cape.
const deerstalker = (sp) => {
  sp.shape(5, [[18, 29], [16, 31], [15, 32], [14, 33], [14, 33], [14, 33]], R.brown);
  for (let y = 6; y <= 10; y++) for (let x = 15; x <= 32; x++) if ((x + y) % 3 === 0) sp.set(x, y, R.brown.l);
  sp.shape(9, Array(5).fill([12, 14]), R.brown);
  sp.shape(9, Array(5).fill([33, 35]), R.brown);
  sp.shape(11, [[18, 29], [19, 28]], shadeOf(R.brown));
};
role(
  "competitor-research", "竞品调研", "focused",
  ["格纹猎鹿帽、两侧耳盖", "束腰双排扣卡其风衣", "披肩后片、后开衩"],
  (sp) => {
    top(sp, R.khaki, { y1: 40, flare: 1 });
    split(sp, 37, 40);
    sp.shape(22, [[12, 19], [12, 19], [13, 19], [15, 19]], R.khaki);
    sp.shape(22, [[28, 35], [28, 35], [28, 34], [28, 32]], R.khaki);
    sp.rect(14, 31, 20, 2, R.brown.b);
    sp.rect(22, 31, 4, 2, R.brass.b);
    for (const y of [27, 35]) dots(sp, [[20, y], [27, y]], R.brown.s);
    sleeves(sp, R.khaki, { cuff: R.brown.b });
    deerstalker(sp);
  },
  (sp) => {
    top(sp, R.khaki, { y1: 40, flare: 1 });
    split(sp, 35, 40);
    sleeves(sp, R.khaki, { cuff: R.brown.b });
    sp.inked((c) => c.shape(22, [[13, 34], [12, 35], [12, 35], [12, 35], [12, 35], [13, 34]], R.khaki));
    sp.rect(14, 31, 20, 2, R.brown.b);
    deerstalker(sp);
  },
);

// copywriting — writer: fedora with a note in its band, teal turtleneck, long ember scarf.
const fedora = (sp) => {
  sp.shape(4, [[17, 21]], R.gray);
  sp.shape(4, [[26, 30]], R.gray);
  sp.shape(5, [[16, 31], [16, 31], [16, 31]], R.gray);
  sp.rect(16, 8, 16, 1, R.ink.b);
  sp.shape(9, [[11, 36], [12, 35]], R.gray);
  dots(sp, [[11, 8], [36, 8]], R.gray.l);
};
role(
  "copywriting", "文案", "calm",
  ["灰色软呢帽、帽带夹便签", "青绿高领毛衣", "长围巾一端垂在背后"],
  (sp) => {
    top(sp, R.teal);
    sp.shape(22, [[18, 29], [18, 29], [19, 28]], shadeOf(R.teal));
    for (let x = 18; x <= 29; x += 2) sp.set(x, 23, R.teal.d);
    sp.rect(14, 35, 20, 2, R.teal.s);
    sleeves(sp, R.teal, { cuff: R.teal.s });
    sp.inked((s) => {
      s.shape(23, [[17, 30], [16, 30]], C.ember);
      s.shape(25, Array(10).fill([17, 20]), C.ember);
      for (const x of [17, 19]) s.set(x, 35, C.ember.d);
    });
    fedora(sp);
    sp.inked((n) => n.rect(28, 5, 2, 3, C.visor.b));
  },
  (sp) => {
    top(sp, R.teal);
    sp.rect(14, 35, 20, 2, R.teal.s);
    sleeves(sp, R.teal, { cuff: R.teal.s });
    sp.inked((s) => {
      s.shape(22, [[17, 30], [16, 31]], C.ember);
      s.shape(24, Array(13).fill([26, 29]), C.ember);
      for (const x of [26, 28]) s.set(x, 37, C.ember.d);
    });
    fedora(sp);
  },
);

// cover-designer — photographer: bucket hat, multi-pocket vest over a sky tee.
const bucket = (sp) => {
  sp.shape(5, [[18, 29], [16, 31], [15, 32], [15, 32]], C.mint);
  sp.shape(9, [[13, 34], [12, 35], [11, 36]], C.mint);
  for (let x = 12; x <= 35; x += 2) sp.set(x, 10, C.mint.s);
};
role(
  "cover-designer", "封面设计", "focused",
  ["薄荷渔夫帽", "多口袋灰色摄影马甲、天蓝 T 恤", "马甲网眼后背"],
  (sp) => {
    top(sp, R.sky);
    sleeves(sp, R.sky, { short: true });
    sp.shape(23, Array(14).fill([14, 20]), R.gray);
    sp.shape(23, Array(14).fill([27, 33]), R.gray);
    for (const [x, y] of [[15, 27], [28, 27], [15, 32], [28, 32]]) {
      sp.rect(x, y, 4, 3, R.gray.s);
      sp.rect(x, y, 4, 1, R.gray.d);
    }
    sp.rect(18, 24, 2, 2, R.gray.d);
    bucket(sp);
  },
  (sp) => {
    top(sp, R.gray);
    sleeves(sp, R.sky, { short: true });
    for (let y = 24; y <= 32; y++) for (let x = 17; x <= 30; x++) if ((x + y) % 2 === 0) sp.set(x, y, R.gray.s);
    sp.rect(16, 33, 16, 1, R.gray.d);
    bucket(sp);
  },
);

// deck-planner — presenter: grey bowler, wine tailcoat over a white shirt, bow tie, tails.
const bowler = (sp) => {
  sp.shape(4, [[19, 28], [17, 30], [16, 31], [16, 31], [16, 31]], R.gray);
  sp.rect(16, 8, 16, 1, R.wine.b);
  sp.shape(9, [[13, 34]], R.gray);
  dots(sp, [[13, 8], [34, 8]], R.gray.s);
};
role(
  "deck-planner", "幻灯片", "happy",
  ["灰色圆顶礼帽", "酒红燕尾服、白衬衫、领结", "长燕尾两片"],
  (sp) => {
    top(sp, R.wine);
    sp.shape(23, [[19, 28], [20, 27], [20, 27], [21, 26], [21, 26], [22, 25], [22, 25], [23, 24]], C.visor);
    sp.inked((b) => {
      b.shape(23, [[19, 21], [20, 21]], R.ink);
      b.shape(23, [[26, 28], [26, 27]], R.ink);
      b.rect(22, 23, 4, 2, R.ink.l);
    });
    dots(sp, [[20, 31], [27, 31], [20, 34], [27, 34]], R.brass.b);
    sp.inked((t) => {
      t.shape(35, [[14, 17], [14, 17], [14, 16], [14, 16], [15, 16]], R.wine);
      t.shape(35, [[30, 33], [30, 33], [31, 33], [31, 33], [31, 32]], R.wine);
    });
    sleeves(sp, R.wine, { cuff: C.visor.b });
    bowler(sp);
  },
  (sp) => {
    top(sp, R.wine, { y1: 33 });
    sp.inked((t) => {
      t.shape(33, [[16, 23], [17, 23], [17, 22], [18, 22], [18, 22], [19, 22], [19, 21], [20, 21]], R.wine);
      t.shape(33, [[24, 31], [24, 30], [25, 30], [25, 29], [25, 29], [25, 28], [26, 28], [26, 27]], R.wine);
    });
    dots(sp, [[20, 33], [27, 33]], R.brass.b);
    sleeves(sp, R.wine, { cuff: C.visor.b });
    bowler(sp);
  },
);

// email-planner — postal carrier: sky kepi with a badge, sky jacket, brown satchel.
const kepi = (sp, front) => {
  sp.shape(4, [[16, 31], [16, 31], [16, 31], [16, 31], [15, 32]], R.sky);
  sp.rect(16, 7, 16, 1, C.ember.b);
  if (front) {
    sp.rect(22, 5, 4, 2, R.brass.b);
    sp.shape(9, [[16, 31], [17, 30]], { l: C.navy.s, b: C.navy.s, s: C.navy.d });
  }
};
role(
  "email-planner", "邮件", "happy",
  ["天蓝筒帽、金色帽徽、黑帽檐", "天蓝短夹克、余烬橙滚边", "斜挎棕色邮包"],
  (sp) => {
    top(sp, R.sky);
    sp.rect(23, 25, 1, 11, C.ember.b);
    sp.rect(14, 35, 20, 2, R.sky.s);
    vee(sp, C.navy.b, 2);
    sleeves(sp, R.sky, { cuff: C.ember.b });
    sp.line(30, 23, 17, 32, R.brown.b, 2);
    sp.inked((b) => {
      b.shape(31, [[11, 19], [11, 19], [11, 19], [11, 19], [11, 19], [11, 19]], R.brown);
      b.rect(11, 31, 9, 3, R.brown.l);
      b.rect(14, 33, 3, 2, R.brass.b);
    });
    kepi(sp, true);
  },
  (sp) => {
    top(sp, R.sky);
    sp.rect(14, 35, 20, 2, R.sky.s);
    sp.rect(15, 23, 18, 1, C.ember.b);
    sleeves(sp, R.sky, { cuff: C.ember.b });
    sp.line(17, 23, 30, 32, R.brown.b, 2);
    sp.inked((b) => b.shape(31, Array(6).fill([28, 36]), R.brown));
    kepi(sp, false);
  },
);

// prompt-writer — the spell-writer: tall star hat, floor-length robe, bell sleeves.
const wizard = (sp) => {
  sp.shape(3, [[23, 24], [22, 25], [21, 26], [20, 27], [19, 28], [17, 30], [15, 32]], C.navy);
  sp.shape(10, [[11, 36], [12, 35]], C.navy);
  dots(sp, [[21, 8], [26, 6], [28, 9], [24, 4]], R.brass.l);
};
role(
  "prompt-writer", "提示词", "calm",
  ["藏青尖顶星星帽", "及地长袍、喇叭袖、金绳腰带", "背后金色月亮与星"],
  (sp) => {
    top(sp, C.navy, { y1: 42, flare: 2 });
    sp.shape(23, [[20, 27], [21, 26], [22, 25]], C.navy.d);
    sp.rect(15, 30, 18, 1, R.brass.b);
    sp.inked((t) => t.rect(23, 31, 1, 5, R.brass.b));
    dots(sp, [[17, 34], [30, 37], [19, 40], [28, 27]], R.brass.l);
    sleeves(sp, C.navy, { bell: true, cuff: C.navy.s });
    wizard(sp);
  },
  (sp) => {
    top(sp, C.navy, { y1: 42, flare: 2 });
    sp.rect(15, 30, 18, 1, R.brass.b);
    sp.shape(24, [[22, 25], [20, 23], [19, 22], [19, 22], [20, 23], [22, 25]], R.brass);
    sp.shape(25, [[23, 25], [22, 24], [22, 24], [23, 25]], C.navy);
    dots(sp, [[28, 25], [27, 34], [20, 38], [29, 40]], R.brass.l);
    sleeves(sp, C.navy, { bell: true, cuff: C.navy.s });
    wizard(sp);
  },
);

// qa-manager — inspector: yellow hard hat, teal coverall, reflective bands on the back.
const hardhat = (sp) => {
  sp.shape(4, [[19, 28], [16, 31], [15, 32], [14, 33], [14, 33], [14, 33]], R.yellow);
  sp.rect(23, 5, 2, 5, R.yellow.l);
  sp.shape(10, [[11, 36]], shadeOf(R.yellow));
};
role(
  "qa-manager", "测试", "focused",
  ["黄色安全帽", "青绿连体工装、胸袋、拉链", "背后两道反光条"],
  (sp) => {
    top(sp, R.teal);
    pants(sp, R.teal);
    sp.rect(23, 23, 2, 13, R.gray.s);
    sp.rect(16, 26, 5, 4, R.teal.s);
    sp.rect(16, 26, 5, 1, R.teal.d);
    sp.rect(14, 33, 20, 1, R.teal.d);
    sleeves(sp, R.teal, { cuff: R.teal.s });
    hardhat(sp);
  },
  (sp) => {
    top(sp, R.teal);
    pants(sp, R.teal);
    for (const y of [27, 32]) {
      sp.rect(14, y, 20, 2, R.gray.l);
      sp.rect(14, y + 1, 20, 1, R.gray.b);
    }
    sleeves(sp, R.teal, { cuff: R.teal.s });
    hardhat(sp);
  },
);

// tech-stack-advisor — professor: mortarboard with a tassel, tweed jacket, elbow patches.
const mortar = (sp, flip) => {
  sp.shape(6, [[15, 32], [15, 32], [15, 32], [16, 31]], R.ink);
  sp.shape(3, [[18, 29], [12, 35], [10, 37], [14, 33]], R.ink);
  const x = flip ? 10 : 36;
  sp.inked((t) => {
    t.rect(x, 5, 1, 6, R.brass.b);
    t.blob(x - 1, 11, 3, 3, R.brass, 1);
  });
};
const tweed = (sp) => {
  for (let y = 24; y <= 36; y++) for (let x = 14; x <= 33; x++) if ((x * 3 + y * 5) % 7 === 0) sp.set(x, y, R.brown.l);
};
role(
  "tech-stack-advisor", "技术选型", "calm",
  ["黑色学位方帽、金流苏", "棕色粗花呢西装、驳领、口袋巾", "肘部深色补丁"],
  (sp) => {
    top(sp, R.brown);
    tweed(sp);
    sp.shape(23, [[19, 28], [20, 27], [21, 26], [22, 25], [23, 24]], C.visor);
    [[19, 24], [20, 26], [21, 28], [28, 24], [27, 26], [26, 28]].forEach(([x, y]) => sp.rect(x, y, 1, 2, R.brown.s));
    sp.rect(28, 29, 3, 1, R.brass.l);
    dots(sp, [[22, 31], [22, 34]], R.ink.b);
    sleeves(sp, R.brown, { cuff: R.brown.s });
    mortar(sp, false);
  },
  (sp) => {
    top(sp, R.brown);
    tweed(sp);
    sp.rect(23, 25, 1, 11, R.brown.s);
    sleeves(sp, R.brown, { cuff: R.brown.s });
    for (const x of [11, 34]) sp.rect(x, 28, 3, 3, R.brown.d);
    mortar(sp, true);
  },
);

// scriptwriter — screenwriter: tweed newsboy cap, argyle vest, rolled script in the back pocket.
const newsboy = (sp, front) => {
  sp.shape(5, [[17, 30], [15, 33], [14, 34], [13, 34], [13, 34]], R.gray);
  for (const [x, y] of [[19, 7], [18, 8], [28, 7], [29, 8], [23, 7], [23, 8]]) sp.set(x, y, R.gray.s);
  if (front) sp.shape(10, [[16, 31], [17, 30]], shadeOf(R.gray));
};
const argyle = (sp) => {
  for (let y = 25; y <= 35; y++)
    for (let x = 15; x <= 32; x++) {
      const d = Math.abs(((x - 15) % 6) - 2.5) + Math.abs(((y - 25) % 6) - 2.5);
      if (d < 2.6) sp.set(x, y, (x + y) % 2 ? R.wine.b : R.wine.s);
      else if (Math.abs(d - 3.5) < 0.3) sp.set(x, y, C.visor.b);
    }
};
role(
  "scriptwriter", "编剧", "calm",
  ["灰色报童帽、前檐", "菱格毛衣背心、挽袖白衬衫", "后袋插卷起的剧本"],
  (sp) => {
    top(sp, C.sand);
    argyle(sp);
    vee(sp, C.visor.b, 4);
    sp.rect(14, 35, 20, 2, C.sand.s);
    sleeves(sp, C.visor, { roll: C.visor.s, y1: 31 });
    newsboy(sp, true);
  },
  (sp) => {
    top(sp, C.sand);
    argyle(sp);
    sp.rect(14, 35, 20, 2, C.sand.s);
    sleeves(sp, C.visor, { roll: C.visor.s, y1: 31 });
    sp.inked((s) => {
      s.rect(28, 30, 3, 8, C.visor.b);
      s.rect(28, 30, 3, 1, C.visor.l);
      s.rect(28, 33, 3, 1, C.ember.b);
    });
    newsboy(sp, false);
  },
);

// hyperframes-editor — editor: big over-ear headphones, grey track jacket with ember stripes.
const phones = (sp) => {
  sp.shape(5, [[18, 29]], R.ink);
  sp.shape(6, [[15, 18]], R.ink);
  sp.shape(6, [[29, 32]], R.ink);
  sp.rect(13, 7, 2, 5, R.ink.b);
  sp.rect(33, 7, 2, 5, R.ink.b);
  sp.inked((c) => {
    c.blob(10, 11, 6, 9, C.ember, 2);
    c.blob(32, 11, 6, 9, C.ember, 2);
    c.rect(11, 13, 1, 5, C.ember.l);
    c.rect(33, 13, 1, 5, C.ember.l);
  });
};
role(
  "hyperframes-editor", "视频剪辑", "focused",
  ["大号头戴耳机、余烬橙耳罩", "灰色立领运动外套、拉链", "肩背橙色横条与耳机线"],
  (sp) => {
    top(sp, R.gray);
    sp.shape(22, [[18, 29], [19, 28]], R.gray);
    sp.rect(23, 23, 2, 13, C.ember.b);
    sp.rect(14, 35, 20, 2, R.gray.s);
    sleeves(sp, R.gray, { cuff: R.gray.s });
    for (const x of [10, 37]) sp.rect(x, 25, 1, 8, C.ember.b);
    phones(sp);
  },
  (sp) => {
    top(sp, R.gray);
    sp.rect(14, 26, 20, 3, C.ember.b);
    sp.rect(14, 26, 20, 1, C.ember.l);
    sp.rect(14, 35, 20, 2, R.gray.s);
    sleeves(sp, R.gray, { cuff: R.gray.s });
    for (const x of [10, 37]) sp.rect(x, 25, 1, 8, C.ember.b);
    sp.line(34, 19, 30, 33, R.ink.b, 1);
    phones(sp);
  },
);

// demo-rehearser — stage crew: headset mic, ember crew tee, lanyard pass, lettered back.
const headset = (sp, front) => {
  sp.shape(6, [[17, 30]], R.ink);
  sp.rect(14, 7, 2, 5, R.ink.b);
  sp.rect(32, 7, 2, 5, R.ink.b);
  sp.inked((e) => {
    e.blob(12, 11, 4, 6, R.gray, 1);
    e.blob(32, 11, 4, 6, R.gray, 1);
  });
  if (front) {
    sp.line(14, 17, 19, 21, R.ink.b, 1);
    sp.inked((m) => m.blob(19, 20, 3, 3, R.gray, 1));
  }
};
role(
  "demo-rehearser", "演示彩排", "happy",
  ["单边麦克风耳麦", "余烬橙工作人员 T 恤、挂绳胸牌", "后背白色字条"],
  (sp) => {
    top(sp, C.ember);
    sleeves(sp, C.ember, { short: true });
    sp.line(19, 23, 22, 28, C.visor.b, 1);
    sp.line(28, 23, 25, 28, C.visor.b, 1);
    sp.inked((b) => {
      b.rect(20, 29, 8, 6, C.visor.b);
      b.rect(20, 29, 8, 2, R.sky.b);
      b.rect(22, 32, 4, 1, C.visor.s);
    });
    headset(sp, true);
  },
  (sp) => {
    top(sp, C.ember);
    sleeves(sp, C.ember, { short: true });
    sp.rect(17, 26, 14, 2, C.visor.b);
    sp.rect(19, 29, 10, 1, C.visor.b);
    headset(sp, false);
  },
);

// video-cloner — lab tech: goggles pushed up, knee-length lab coat, half belt and vent.
const goggles = (sp) => {
  sp.rect(13, 8, 22, 2, R.ink.b);
  for (const x of [15, 26]) {
    sp.inked((g) => {
      g.blob(x, 4, 7, 6, R.gray, 2);
      g.blob(x + 1, 5, 5, 4, R.sky, 1);
    });
  }
};
role(
  "video-cloner", "视频克隆", "focused",
  ["额头推起的护目镜", "及膝白大褂、驳领、胸袋插笔", "后腰半截腰带、开衩"],
  (sp) => {
    top(sp, R.white, { y1: 40, flare: 1 });
    split(sp, 33, 40);
    sp.shape(23, [[20, 27], [21, 26], [22, 25], [23, 24]], R.sky.s);
    [[19, 24], [20, 26], [21, 28], [28, 24], [27, 26], [26, 28]].forEach(([x, y]) => sp.rect(x, y, 1, 2, R.white.s));
    sp.rect(16, 28, 4, 3, R.white.s);
    sp.rect(17, 26, 1, 3, R.sky.b);
    sp.rect(15, 34, 5, 3, R.white.s);
    sp.rect(28, 34, 5, 3, R.white.s);
    sleeves(sp, R.white, { cuff: R.white.s });
    goggles(sp);
  },
  (sp) => {
    top(sp, R.white, { y1: 40, flare: 1 });
    split(sp, 33, 40);
    sp.rect(17, 30, 14, 2, R.white.s);
    dots(sp, [[18, 30], [29, 30]], R.gray.b);
    sleeves(sp, R.white, { cuff: R.white.s });
    goggles(sp);
  },
);

// discussion-helper — host of the chat: knit beanie, lilac shawl-collar sweater.
const beanie = (sp) => {
  sp.shape(4, [[19, 28], [17, 30], [15, 32], [14, 33], [14, 33], [13, 34], [13, 34], [13, 34]], C.ember);
  for (let x = 13; x <= 34; x += 2) sp.rect(x, 9, 1, 3, C.ember.s);
};
const knit = (sp) => {
  for (const x of [17, 30]) for (let y = 27; y <= 34; y += 2) dots(sp, [[x, y], [x + 1, y + 1]], C.lilac.l);
};
role(
  "discussion-helper", "讨论", "happy",
  ["余烬橙罗纹毛线帽（天线球作帽球）", "淡紫粗针披肩领毛衣", "披肩领翻在后颈、麻花纹"],
  (sp) => {
    top(sp, C.lilac);
    knit(sp);
    sp.shape(22, [[16, 31], [15, 32], [16, 20], [17, 20], [18, 20]], C.visor);
    sp.shape(24, [[27, 31], [27, 30], [27, 29]], C.visor);
    sp.rect(21, 24, 6, 4, C.lilac.d);
    dots(sp, [[24, 30], [24, 33]], C.visor.s);
    sp.rect(14, 35, 20, 2, C.lilac.s);
    sleeves(sp, C.lilac, { cuff: C.lilac.s });
    beanie(sp);
  },
  (sp) => {
    top(sp, C.lilac);
    knit(sp);
    for (let y = 29; y <= 34; y += 2) dots(sp, [[23, y], [24, y + 1]], C.lilac.l);
    sp.shape(22, [[16, 31], [15, 32], [15, 32], [17, 30]], C.visor);
    sp.rect(14, 35, 20, 2, C.lilac.s);
    sleeves(sp, C.lilac, { cuff: C.lilac.s });
    beanie(sp);
  },
);

// memory-pruner — the reviewed archivist: green eyeshade, glasses, peach cardigan, files.
const glasses = (sp) => {
  for (const x of [18, 26]) {
    sp.rect(x, 13, 4, 1, C.steel);
    sp.rect(x, 17, 4, 1, C.steel);
    sp.rect(x, 13, 1, 5, C.steel);
    sp.rect(x + 3, 13, 1, 5, C.steel);
  }
  sp.rect(22, 14, 4, 1, C.steel);
};
role(
  "memory-pruner", "记忆整理", "calm",
  ["绿色透明遮光帽檐、圆框眼镜", "蜜桃开衫、袖口卷边", "背负三格抽屉柜"],
  (sp) => {
    sp.blob(11, 20, 26, 18, C.sand, 1);
    bodyFront(sp, { hands: 34 });
    faceFront(sp, "calm");
    glasses(sp);
    top(sp, C.peach);
    sp.rect(14, 36, 20, 1, C.peach.d);
    sp.shape(23, [[20, 27], [21, 26], [22, 25], [23, 24]], C.visor.b);
    sp.rect(23, 27, 2, 9, C.peach.s);
    for (const y of [29, 32]) sp.rect(23, y, 2, 1, C.visor.b);
    sp.rect(17, 32, 4, 3, C.peach.s);
    sp.rect(27, 32, 4, 3, C.peach.s);
    sleeves(sp, C.peach, { cuff: C.peach.d });
    sp.rect(13, 9, 22, 2, C.mint.d);
    sp.shape(11, [[13, 34], [12, 35]], C.mint);
  },
  (sp) => {
    top(sp, C.peach);
    sleeves(sp, C.peach, { cuff: C.peach.d });
    sp.inked((c) => {
      c.blob(13, 20, 22, 18, C.sand, 1);
      for (const y of [22, 28, 33]) {
        c.rect(14, y + 4, 20, 1, C.sand.s);
        c.rect(22, y + 1, 4, 2, C.visor.b);
        c.rect(23, y + 1, 2, 1, C.steel);
      }
    });
    sp.rect(13, 9, 22, 2, C.mint.d);
    sp.rect(23, 9, 2, 2, C.mint.l);
  },
  true,
);

// chat-reviewer — the clerk who writes up conversations: navy side cap, sky shirt, braces.
const sidecap = (sp, flip) => {
  const rows = [[23, 32], [19, 34], [15, 34], [14, 31]];
  sp.shape(5, flip ? rows.map(([a, b]) => [47 - b, 47 - a]) : rows, C.navy);
  sp.line(flip ? 32 : 15, 7, flip ? 18 : 29, 5, R.brass.b, 1);
};
role(
  "chat-reviewer", "对话回顾", "calm",
  ["藏青斜戴船形帽、金边", "白衬衫、黑色袖箍、棕背带", "背带 Y 形交汇"],
  (sp) => {
    top(sp, R.white);
    vee(sp, R.white.d, 2);
    dots(sp, [[24, 27], [24, 31], [24, 35]], C.visor.b);
    for (const x of [17, 29]) sp.rect(x, 23, 2, 14, R.brown.b);
    sleeves(sp, R.white, { cuff: R.white.s });
    for (const x of [10, 33]) sp.rect(x, 28, 5, 1, R.ink.b);
    sidecap(sp, false);
  },
  (sp) => {
    top(sp, R.white);
    sp.line(17, 23, 23, 30, R.brown.b, 2);
    sp.line(30, 23, 24, 30, R.brown.b, 2);
    sp.rect(23, 30, 2, 7, R.brown.b);
    sleeves(sp, R.white, { cuff: R.white.s });
    for (const x of [10, 33]) sp.rect(x, 28, 5, 1, R.ink.b);
    sidecap(sp, true);
  },
);

// dismissal-reviewer — referee: black cap, black-and-white striped shirt, numbered back.
const refcap = (sp, front) => {
  sp.shape(5, [[18, 29], [16, 31], [15, 32], [14, 33], [14, 33]], R.ink);
  sp.rect(14, 9, 20, 1, C.visor.s);
  if (front) sp.shape(10, [[13, 34], [14, 33]], shadeOf(R.ink));
  else {
    sp.rect(21, 7, 6, 2, C.body.l);
    sp.rect(21, 8, 6, 1, C.visor.s);
  }
};
const stripes = (sp) => {
  for (let x = 14; x <= 33; x++) if (Math.floor((x - 14) / 2) % 2) sp.rect(x, 24, 1, 13, R.ink.b);
};
role(
  "dismissal-reviewer", "驳回复盘", "focused",
  ["黑色裁判帽", "黑白竖条纹裁判衫、黑领", "后背白底号码牌"],
  (sp) => {
    top(sp, R.white);
    stripes(sp);
    sp.shape(23, [[18, 29], [19, 22], [25, 28]], R.ink);
    vee(sp, R.ink.l, 3, 24);
    sleeves(sp, R.white, { short: true, cuff: R.ink.b });
    refcap(sp, true);
  },
  (sp) => {
    top(sp, R.white);
    stripes(sp);
    sp.rect(15, 23, 18, 2, R.ink.b);
    sp.inked((n) => {
      n.rect(19, 27, 10, 7, C.visor.b);
      n.rect(23, 28, 2, 5, R.ink.b);
      n.set(22, 29, R.ink.b);
    });
    sleeves(sp, R.white, { short: true, cuff: R.ink.b });
    refcap(sp, false);
  },
);

// project-writer — the guide who describes the project: pillbox cap, short sky cape.
const pillbox = (sp) => {
  sp.shape(5, [[19, 30], [19, 30], [19, 30], [18, 31]], C.navy);
  sp.rect(18, 8, 14, 1, R.brass.b);
};
role(
  "project-writer", "项目概况", "happy",
  ["藏青小圆筒帽、金边", "天蓝短披风、橙色领巾、白衬衫", "整片披风后背、金色扣边"],
  (sp) => {
    top(sp, C.visor);
    sleeves(sp, C.visor, { cuff: C.visor.s });
    sp.inked((c) => {
      c.shape(23, [[13, 34], [11, 36], [10, 37], [10, 37], [10, 37], [10, 37], [10, 37], [11, 36]], R.sky);
      c.shape(23, Array(8).fill([21, 26]), C.visor);
      c.shape(23, [[19, 28], [20, 27], [22, 25], [23, 24]], C.ember);
      for (const y of [25, 29]) dots(c, [[20, y], [27, y]], R.brass.b);
    });
    pillbox(sp);
  },
  (sp) => {
    top(sp, C.visor);
    sleeves(sp, C.visor, { cuff: C.visor.s });
    sp.inked((c) => {
      c.shape(23, [[13, 34], [11, 36], [10, 37], [10, 37], [10, 37], [10, 37], [10, 37], [10, 37], [11, 36]], R.sky);
      c.rect(10, 31, 28, 1, R.brass.b);
      c.rect(23, 25, 2, 2, R.brass.b);
    });
    pillbox(sp);
  },
);

// proposer — the herald: wine cap with an ember feather, split tabard, crest on the back.
const feathered = (sp, flip) => {
  sp.inked((f) => {
    f.stroke(flip ? 16 : 30, 8, flip ? 10 : 36, 1, 2, C.ember);
    f.line(flip ? 16 : 31, 8, flip ? 11 : 36, 2, C.ember.l, 1);
  });
  sp.shape(5, [[17, 30], [14, 33], [13, 34], [13, 34]], R.wine);
  sp.rect(13, 8, 22, 1, R.wine.s);
};
role(
  "proposer", "提议", "happy",
  ["酒红软帽、插余烬橙羽毛", "左橙右沙双色罩袍、奶白泡泡袖", "后背金色菱形纹章"],
  (sp) => {
    top(sp, C.visor);
    sleeves(sp, C.visor, { cuff: C.visor.s });
    sp.shape(23, Array(16).fill([16, 23]), C.ember);
    sp.shape(23, Array(16).fill([24, 31]), C.sand);
    sp.rect(16, 31, 16, 1, R.brown.b);
    sp.rect(23, 31, 2, 1, R.brass.b);
    feathered(sp, false);
  },
  (sp) => {
    top(sp, C.visor);
    sleeves(sp, C.visor, { cuff: C.visor.s });
    sp.shape(23, Array(16).fill([16, 23]), C.sand);
    sp.shape(23, Array(16).fill([24, 31]), C.ember);
    sp.rect(16, 31, 16, 1, R.brown.b);
    sp.shape(24, [[23, 24], [22, 25], [21, 26], [22, 25], [23, 24]], R.brass);
    feathered(sp, true);
  },
);

// feedback (hidden) — the diagnostician: head mirror, mint scrubs, tie strings on the back.
const mirror = (sp) => {
  sp.rect(13, 9, 22, 2, R.gray.s);
  sp.inked((m) => {
    m.blob(19, 4, 10, 7, R.white, 3);
    m.rect(23, 6, 2, 2, R.gray.d);
  });
};
role(
  "feedback", "反馈（隐藏）", "focused",
  ["额镜头带", "薄荷短袖 V 领手术服、胸袋插笔", "后颈系带"],
  (sp) => {
    top(sp, C.mint);
    pants(sp, C.mint);
    vee(sp, C.body.b, 4);
    sp.rect(26, 27, 5, 4, C.mint.s);
    sp.rect(27, 25, 1, 3, C.ember.b);
    sleeves(sp, C.mint, { short: true, cuff: C.mint.s });
    mirror(sp);
  },
  (sp) => {
    top(sp, C.mint);
    pants(sp, C.mint);
    sp.line(21, 23, 19, 28, C.mint.d, 1);
    sp.line(26, 23, 28, 28, C.mint.d, 1);
    sp.rect(22, 23, 4, 1, C.mint.d);
    sleeves(sp, C.mint, { short: true, cuff: C.mint.s });
    mirror(sp);
  },
);

// social-illustrator — social artist: open-top sky sun visor, wine bomber, heart patch.
const sunVisor = (sp, front) => {
  sp.shape(7, [[13, 34], [13, 34]], R.sky);
  if (front) sp.shape(9, [[11, 36], [12, 35]], shadeOf(R.sky));
  else sp.rect(22, 7, 4, 2, R.sky.d);
};
const bomber = (sp) => {
  top(sp, R.wine);
  sp.rect(18, 23, 12, 1, C.visor.s);
  for (let x = 14; x <= 33; x++) sp.rect(x, 35, 1, 2, x % 2 ? C.visor.b : C.visor.s);
  sleeves(sp, R.wine, { cuff: C.visor.b });
};
role(
  "social-illustrator", "社交配图", "happy",
  ["天蓝遮阳帽檐、露出头顶", "酒红短款飞行夹克、奶白罗纹领口与下摆", "背后余烬橙爱心贴布"],
  (sp) => {
    bomber(sp);
    sp.rect(23, 24, 2, 11, R.wine.d);
    sp.rect(23, 26, 2, 2, R.brass.b);
    sunVisor(sp, true);
  },
  (sp) => {
    bomber(sp);
    sp.inked((h) => {
      h.shape(28, [[19, 28], [19, 28], [20, 27], [21, 26], [22, 25], [23, 24]], C.ember);
      h.rect(20, 27, 3, 1, C.ember.l);
      h.rect(25, 27, 3, 1, C.ember.l);
    });
    sunVisor(sp, false);
  },
);

// Body first, then the costume, then the antenna tip — always on top.
const dress = (r, view) => (sp) => {
  if (r.custom && view === "front") {
    r.front(sp);
    return tip(sp);
  }
  if (view === "front") {
    bodyFront(sp, { hands: 34 });
    faceFront(sp, r.eyes);
  } else bodyBack(sp, { hands: 34 });
  r[view](sp);
  tip(sp);
};
// --- reading a costume ---------------------------------------------------------------

const render = (fn) => {
  const sp = new Sprite();
  fn(sp);
  return sp;
};
// What the outfit paints over the bare body: a pixel map, plus where it cut the body away.
function layer(r, view) {
  const full = render(dress(r, view));
  const bare = render((sp) => {
    if (view === "front") {
      bodyFront(sp, { hands: 34 });
      faceFront(sp, r.eyes);
    } else bodyBack(sp, { hands: 34 });
    tip(sp);
  });
  const px = new Map();
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const c = full.get(x, y);
      if (c && c !== bare.get(x, y)) px.set(`${x},${y}`, c);
    }
  return px;
}

const RAMPS = [...Object.values(C), ...Object.values(R)].filter((r) => typeof r === "object" && r.b);
const rampOf = (c) => RAMPS.find((r) => [r.l, r.b, r.s, r.d].includes(c)) ?? (c ? flat(c) : null);
const mostOf = (cs) => {
  const n = new Map();
  for (const c of cs) if (c) n.set(c, (n.get(c) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0];
};

// Sleeve: its ramp and the row its cloth ends on, read off the front's right arm (x 33–37).
// Trousers: the ramp the front paints on the legs below the garment.
function cut(front) {
  const at = (x, y) => front.get(`${x},${y}`);
  let end = 0;
  const cloth = [];
  for (let y = 24; y <= 36; y++)
    for (const x of [34, 35, 36]) {
      const c = at(x, y);
      if (c && c !== C.body.b && c !== C.body.l && c !== C.body.s) {
        end = Math.max(end, y);
        cloth.push(c);
      }
    }
  const sleeve = end >= 26 ? rampOf(mostOf(cloth)) : null;
  const legCs = [];
  for (let y = 38; y <= 41; y++) for (const x of [19, 20, 27, 28]) legCs.push(at(x, y));
  const pants = legCs.filter(Boolean).length >= 10 ? rampOf(mostOf(legCs)) : null;
  let hem = 36;
  for (let y = 36; y <= 44; y++) if ([23, 24, 15, 32].some((x) => at(x, y))) hem = y;
  return { sleeve, end: Math.min(end, 34), short: end > 0 && end < 30, pants, hem };
}

const recolor = (sp, y0, y1, ramp) => {
  const map = { [C.body.l]: ramp.l, [C.body.b]: ramp.b, [C.body.s]: ramp.s };
  for (let y = y0; y <= y1; y++)
    for (let x = 0; x < S; x++) {
      const c = sp.get(x, y);
      if (map[c]) sp.px[y * S + x] = map[c];
    }
};

// --- side and walk -------------------------------------------------------------------

// Front columns squeeze toward the profile's centre; the visor's right half rides the
// profile visor, so glasses and goggles still show one lens.
function sideCostume(sp, front, { pants, hem, pack }) {
  for (const [k, c] of front) {
    const [x, y] = k.split(",").map(Number);
    // The pack's edges peeking past the body in front are the slab in profile.
    if (pack && pack.tones.includes(c) && (x < 14 || x > 33 || y < 23)) continue;
    if (y <= 22) {
      if (y >= 11 && y <= 19 && x >= 16 && x <= 31) {
        if (x >= 24) sp.set(x + 3, y, c);
        continue;
      }
      sp.set(Math.round(24 + (x - 23.5) * 0.86), y, c);
    } else {
      if (y <= 36 && (x < 14 || x > 33)) continue;
      if (y > 36 && (pants || y > hem)) continue;
      sp.set(Math.round(23.5 + (x - 23.5) * 0.72), y, c);
    }
  }
}

// A side arm from the shoulder to a hand at (hx, hy), in the sleeve's ramp down to its cuff.
function sideArm(a, [hx, hy], far, k) {
  const r = k.sleeve && (far ? flat(k.sleeve.s) : k.sleeve);
  const body = far ? flat(C.body.s) : C.body;
  if (r && !far) a.blob(21, 24, 5, 4, r, 1);
  if (r && !k.short) {
    if (hx === 22) a.shape(25, Array(hy - 27).fill([21, 25]), r);
    else a.stroke(hx < 22 ? 21 : 22, 26, hx, hy - 4, 4, r);
    a.rect(hx, hy - 1, 4, 1, r.s);
  } else {
    if (r) a.shape(25, Array(4).fill([21, 25]), r);
    a.line(23, 28, hx + 1, hy - 1, body.b, 2);
  }
  a.blob(hx, hy, 4, 3, body, 1);
}

// A bulky back mark — pack, cabinet, tube, board — shows in profile as a lit slab behind
// the back, in the mark's own ramp, over the rows the mark covers.
const PACKS = new Set(["software-planner", "blog-researcher", "illustrator", "memory-pruner"]);
const BODY = [C.body.l, C.body.b, C.body.s, INK];
function pack(k) {
  const torso = [];
  for (const [key, c] of k.front) {
    const [x, y] = key.split(",").map(Number);
    if (y >= 24 && y <= 35 && x >= 15 && x <= 32 && !BODY.includes(c)) torso.push(c);
  }
  const cloth = rampOf(mostOf(torso));
  const own = (c) => !BODY.includes(c) && ![cloth.l, cloth.b, cloth.s, cloth.d].includes(c);
  const marks = [...k.back].filter(([key, c]) => own(c) && +key.split(",")[1] >= 18);
  const ramp = rampOf(mostOf(marks.map(([, c]) => c)));
  const tones = [ramp.l, ramp.b, ramp.s, ramp.d];
  const ys = marks.filter(([, c]) => tones.includes(c)).map(([key]) => +key.split(",")[1]);
  // A shade row across most of the mark is a drawer or seam line; keep it on the slab.
  const n = new Map();
  for (const [key, c] of marks) if (c === ramp.s) n.set(+key.split(",")[1], (n.get(+key.split(",")[1]) ?? 0) + 1);
  const lines = [...n].filter(([, v]) => v >= 10).map(([y]) => y);
  return { ramp, tones, lines, y0: Math.max(19, Math.min(...ys)), y1: Math.min(39, Math.max(...ys)) };
}
const slab = (sp, { ramp, lines, y0, y1 }) =>
  sp.inked((s) => {
    s.blob(12, y0, 7, y1 - y0 + 1, ramp, 1);
    for (const y of lines) s.rect(12, y, 6, 1, ramp.d);
  });

function side(r, k, w = { legs: [21, 21], lift: [0, 0], near: [22, 33], far: null, bob: 0 }) {
  return (sp) => {
    sp.dy = w.bob;
    if (k.pack) slab(sp, k.pack);
    bodySide(sp, { ...w, far: w.far && ((a) => sideArm(a, w.far, true, k)) });
    if (k.pants) {
      sp.dy = 0;
      recolor(sp, 36, 41 - Math.max(...w.lift), k.pants);
      sp.dy = w.bob;
    }
    faceSide(sp, r.eyes);
    sideCostume(sp, k.front, k);
    sp.inked((a) => sideArm(a, w.near, false, k));
    tip(sp);
    sp.dy = 0;
  };
}

// --- back at the desk ----------------------------------------------------------------

function dressedTyping(a, up, k) {
  const hy = 26 - up * 2;
  const [ex, ey] = [7, 30 - up];
  const r = k.sleeve;
  if (r) a.stroke(11, 24, ex, ey, 4, r);
  else a.line(12, 25, ex + 1, ey, C.body.b, 2);
  if (r && !k.short) {
    a.stroke(ex, ey, 8, hy + 2, 4, r);
    a.rect(8, hy + 2, 4, 1, r.s);
  } else a.line(ex + 1, ey, 9, hy + 2, C.body.b, 2);
  a.blob(8, hy, 4, 3, C.body, 1);
}

function work(r, k, step) {
  const hands = [[1, 0], [0, 0], [0, 1], [0, 0]][step];
  const nod = step % 2;
  return (sp) => {
    bodyFront(sp, { arms: false, head: nod });
    sp.dy = nod;
    for (const y of [14, 16, 18]) sp.rect(20, y, 8, 1, C.body.s);
    sp.dy = 0;
    for (const [key, c] of k.back) {
      const [x, y] = key.split(",").map(Number);
      if (y >= 24 && y <= 37 && (x < 14 || x > 33)) continue;
      sp.set(x, y <= 22 ? y + nod : y, c);
    }
    hands.forEach((up, i) =>
      sp.inked((s) => {
        dressedTyping(s, up, k);
        if (i) s.mirror();
      }),
    );
    sp.dy = nod;
    tip(sp);
    sp.dy = 0;
  };
}

// --- on the sofa ---------------------------------------------------------------------

// The head drops six rows; the chest keeps its rows, and the garment's last rows fold
// across the thighs, as long as the garment ran past the hips.
function sit(r, k) {
  return (sp) => {
    bodySit(sp, { arms: false });
    if (k.pants) recolor(sp, 36, 41, k.pants);
    sp.dy = SIT;
    faceFront(sp, r.eyes);
    sp.dy = 0;
    const fold = Math.max(2, Math.min(5, k.hem - 34));
    for (const [key, c] of k.front) {
      const [x, y] = key.split(",").map(Number);
      if (y <= 30) {
        if (y >= 24 && (x < 14 || x > 33)) continue;
        sp.set(x, y + SIT, c);
      } else if (y > k.hem - fold && y <= k.hem && x >= 13 && x <= 34) sp.set(x, 37 + y - (k.hem - fold + 1), c);
    }
    for (const x of [10, 33]) {
      sp.inked((s) => {
        if (k.sleeve) {
          const rows = k.short ? 2 : 5;
          s.shape(30, [[x + 2, x + 4], ...Array(rows).fill([x, x + 4])], k.sleeve);
          if (!k.short) s.rect(x, 35, 5, 1, k.sleeve.s);
        }
        if (!k.sleeve || k.short) s.rect(x + 2, 32, 2, 5, C.body.b);
        s.blob(x + 1, 37, 4, 3, C.body, 1);
      });
    }
    sp.dy = SIT;
    tip(sp);
    sp.dy = 0;
  };
}

// --- the doc and video screens -------------------------------------------------------

function mediaScreen(kind, step) {
  const px = new Array(SCREEN.w * SCREEN.h).fill(null);
  const rect = (x, y, w, h, c) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px[j * SCREEN.w + i] = c;
  };
  rect(1, 1, 74, 39, "#0a1f15");
  if (kind === "doc") {
    // A page being written: the caret runs along the last line.
    rect(16, 3, 44, 35, C.visor.b);
    rect(20, 6, 26, 3, C.navy.b);
    const lines = [34, 30, 36, 22];
    lines.forEach((w, i) => rect(20, 12 + i * 4, w, 1, C.sand.d));
    const typed = [6, 12, 18, 24][step];
    rect(20, 28, typed, 1, C.body.b);
    if (step % 2 === 0) rect(20 + typed + 1, 26, 1, 4, C.ember.b);
    rect(20, 32, 14, 1, C.sand.d);
  } else {
    // A video timeline: a preview frame above two clip tracks and a moving playhead.
    rect(18, 3, 40, 20, "#12301f");
    rect(20, 5, 36, 16, C.sky);
    rect(20, 15, 36, 6, C.mint.s);
    rect(40, 8, 6, 6, C.peach.b);
    rect(3, 26, 70, 5, "#12301f");
    rect(3, 32, 70, 5, "#12301f");
    for (const [x, w, c] of [[4, 18, C.lilac.b], [24, 26, C.sky], [52, 20, C.ember.b]]) rect(x, 27, w, 3, c);
    for (const [x, w] of [[4, 30], [36, 36]]) rect(x, 33, w, 3, C.mint.b);
    const head = 10 + step * 14;
    rect(head, 25, 1, 13, "#ffffff");
    rect(head - 1, 24, 3, 1, "#ffffff");
  }
  return { px, w: SCREEN.w, h: SCREEN.h };
}


// --- the cast ------------------------------------------------------------------------

// What a job's desk screen shows. A job not listed, custom agents included, keeps code:
// the desk's own picture.
const SCREEN_OF = {
  doc: [
    "software-planner", "tech-stack-advisor", "competitor-research", "prompt-writer", "copywriting",
    "blog-planner", "blog-researcher", "email-planner", "scriptwriter", "discussion-helper",
    "memory-pruner", "chat-reviewer", "dismissal-reviewer", "project-writer", "proposer", "feedback",
  ],
  design: [
    "ui-designer", "illustrator", "blog-illustrator", "social-illustrator", "carousel-planner",
    "deck-planner", "cover-designer",
  ],
  video: ["hyperframes-editor", "demo-rehearser", "video-cloner"],
};
const screenOf = (name) => Object.keys(SCREEN_OF).find((k) => SCREEN_OF[k].includes(name)) ?? "code";

const STEPS = [0, 1, 2, 3];
const JOBS = [
  ...[["builder", "开发", builder], ["ui-designer", "界面设计", uiDesigner], ["base", "自定义", base]].map(([name, zh, job]) => ({
    name,
    zh,
    front: (sp) => job.front(sp),
    side: (sp) => job.side(sp),
    back: (sp) => job.back(sp),
    sit: (sp) => job.sit(sp),
    bare: name !== "base" && {
      front: (sp) => job.front(sp, { prop: false }),
      back: (sp) => job.back(sp, { prop: false }),
    },
    walk: STEPS.map((step) => (sp) => job.walk(sp, step)),
    work: STEPS.map((step) => (sp) => job.work(sp, step)),
  })),
  ...ROLES.map((r) => {
    const front = layer(r, "front");
    const k = { ...cut(front), front, back: layer(r, "back") };
    if (PACKS.has(r.name)) k.pack = pack(k);
    return {
      name: r.name,
      zh: r.zh,
      front: dress(r, "front"),
      side: side(r, k),
      back: dress(r, "back"),
      sit: sit(r, k),
      walk: WALK.map((w) => side(r, k, w)),
      work: STEPS.map((step) => work(r, k, step)),
    };
  }),
];

// --- output -------------------------------------------------------------------------

const draw = (fn) => {
  const sp = new Sprite();
  fn(sp);
  return sp.outline();
};

// Frames side by side; a frame is a Sprite or any { px, w, h }.
function png(frames) {
  const fw = frames[0].w ?? S;
  const fh = frames[0].h ?? S;
  return encode(fw * frames.length, fh, (x, y) => frames[Math.floor(x / fw)].px[y * fw + (x % fw)]);
}

function encode(w, h, at) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      if (!c) continue;
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = parseInt(c.slice(1, 3), 16);
      raw[o + 1] = parseInt(c.slice(3, 5), 16);
      raw[o + 2] = parseInt(c.slice(5, 7), 16);
      raw[o + 3] = 255;
    }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

const here = dirname(fileURLToPath(import.meta.url));
const ui = join(here, "..");
const out = join(here, "png");
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
const put = (dir, file, frames) => writeFileSync(join(dir, `${file}.png`), png(frames));

// The code screen is the desk's own, cropped out of its four frames.
const sharp = createRequire(join(ui, "package.json"))("sharp");
const desk = await sharp(join(ui, "public/run-scene/layers/desk-work.png")).raw().toBuffer({ resolveWithObject: true });
const codeScreen = (step) => {
  const px = new Array(SCREEN.w * SCREEN.h).fill(null);
  const hex = (v) => v.toString(16).padStart(2, "0");
  for (let y = 0; y < SCREEN.h; y++)
    for (let x = 0; x < SCREEN.w; x++) {
      const o = ((SCREEN.y + y) * desk.info.width + step * 284 + SCREEN.x + x) * desk.info.channels;
      if (desk.data[o + 3] > 0) px[y * SCREEN.w + x] = `#${hex(desk.data[o])}${hex(desk.data[o + 1])}${hex(desk.data[o + 2])}`;
    }
  return { px, w: SCREEN.w, h: SCREEN.h };
};
const SCREENS = {
  code: STEPS.map(codeScreen),
  doc: STEPS.map((s) => mediaScreen("doc", s)),
  design: STEPS.map(designScreen),
  video: STEPS.map((s) => mediaScreen("video", s)),
};

const drawn = JOBS.map((job) => ({
  ...job,
  still: Object.fromEntries(["front", "side", "back", "sit"].map((v) => [v, draw(job[v])])),
  walk: job.walk.map(draw),
  work: job.work.map(draw),
}));
for (const job of drawn) {
  for (const [view, sp] of Object.entries(job.still)) put(out, `${job.name}-${view}`, [sp]);
  if (job.bare) for (const view of ["front", "back"]) put(out, `${job.name}-${view}-noprop`, [draw(job.bare[view])]);
  for (const loop of ["walk", "work"]) job[loop].forEach((f, i) => put(out, `${job.name}-${loop}-${i + 1}`, [f]));
}
for (const [kind, frames] of Object.entries(SCREENS)) put(out, `screen-${kind}`, frames);
// The cast for preview.html, which reads it as a script so it opens straight from disk.
writeFileSync(
  join(out, "cast.js"),
  `window.CAST = ${JSON.stringify(drawn.map((j) => ({ name: j.name, zh: j.zh, screen: screenOf(j.name), bare: !!j.bare })))};\n`,
);

// The avatars: the front view, under the job's own name. The site keeps the names it has,
// and its `planner.png` is the software planner.
const avatars = join(ui, "public/agent-art");
const site = join(ui, "../web/public/agent-art");
const siteNames = new Set(readdirSync(site).map((f) => f.replace(/\.png$/, "")));
for (const job of drawn) {
  put(avatars, job.name, [job.still.front]);
  if (siteNames.has(job.name)) put(site, job.name, [job.still.front]);
  if (job.name === "software-planner") put(site, "planner", [job.still.front]);
}

// The office's atlas: a row per job — type ×4, walk ×4 facing right, sit — then a row of the
// desk screens other than code, which the desk art already shows.
const FRAMES = ["type", "type", "type", "type", "walk", "walk", "walk", "walk", "sit"];
const SHOWN = ["doc", "design", "video"];
const atlas = { w: Math.max(FRAMES.length * S, SHOWN.length * 4 * SCREEN.w), h: drawn.length * S + SCREEN.h };
const cells = [];
const sheet = { frames: {}, animations: {}, meta: { image: "cast.png", size: atlas, scale: "1", screens: {} } };
const cell = (key, x, y, frame) => {
  cells.push({ x, y, frame });
  const w = frame.w ?? S;
  const h = frame.h ?? S;
  sheet.frames[key] = { frame: { x, y, w, h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h } };
  const anim = key.replace(/-\d$/, "");
  (sheet.animations[anim] ??= []).push(key);
};
drawn.forEach((job, row) => {
  const frames = [...job.work, ...job.walk, job.still.sit];
  frames.forEach((f, i) => cell(`${job.name}/${FRAMES[i]}-${i < 8 ? i % 4 : 0}`, i * S, row * S, f));
  const kind = screenOf(job.name);
  if (kind !== "code") sheet.meta.screens[job.name] = kind;
});
SHOWN.forEach((kind, k) =>
  SCREENS[kind].forEach((f, i) => cell(`screen/${kind}-${i}`, (k * 4 + i) * SCREEN.w, drawn.length * S, f)),
);
writeFileSync(
  join(ui, "public/run-scene/cast.png"),
  encode(atlas.w, atlas.h, (x, y) => {
    const c = cells.find((c) => x >= c.x && y >= c.y && x < c.x + (c.frame.w ?? S) && y < c.y + (c.frame.h ?? S));
    return c ? c.frame.px[(y - c.y) * (c.frame.w ?? S) + (x - c.x)] : null;
  }),
);
writeFileSync(join(ui, "public/run-scene/cast.json"), `${JSON.stringify(sheet, null, 1)}\n`);

// The loops as videos for review: every job in a grid at 4×, on paper, four frames looped.
const PAPER = "#f6f2e6";
const COLS = 9;
const loops = join(here, "loops");
mkdirSync(loops, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "akb-loops-"));
for (const [loop, ms] of [["walk", 150], ["work", 160]]) {
  const rows = Math.ceil(drawn.length / COLS);
  STEPS.forEach((step) =>
    writeFileSync(
      join(tmp, `${loop}-${step}.png`),
      encode(COLS * S, rows * S, (x, y) => {
        const job = drawn[Math.floor(y / S) * COLS + Math.floor(x / S)];
        return (job && job[loop][step].px[(y % S) * S + (x % S)]) || PAPER;
      }),
    ),
  );
  const ffmpeg = (args) => spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
  const scale = "scale=iw*4:ih*4:flags=neighbor";
  const made = ffmpeg([
    "-framerate", `${1000 / ms}`, "-stream_loop", "5", "-i", join(tmp, `${loop}-%d.png`),
    "-vf", `${scale},format=yuv420p`, "-an", "-c:v", "libx264", "-crf", "12", "-movflags", "+faststart",
    join(loops, `${loop}.mp4`),
  ]);
  if (made.error) console.warn(`ffmpeg not found — ${loop}.mp4 not rendered`);
  else ffmpeg(["-i", join(tmp, `${loop}-0.png`), "-vf", scale, join(loops, `${loop}-poster.png`)]);
}
rmSync(tmp, { recursive: true, force: true });
