// The character design: every sprite is drawn here, pixel by pixel, on a 48x48 canvas.
// `node kanban-ui/character-design/draw.mjs` writes the PNGs in `png/` and the sheets
// `preview.html` lays out. README.md is the spec.
import { mkdirSync, writeFileSync } from "node:fs";
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
  brass: ramp("#f6d58a", "#e3ac3f", "#a8741f"),
  mint: ramp("#c4ead2", "#7fca9c", "#4f9d70", "#2f6b46"),
  lilac: ramp("#d4c6f0", "#b199e0", "#8a6fc4", "#5a3f92"),
  peach: ramp("#f6c3a6", "#ec9a72", "#c06f47", "#8a4a28"),
  sand: ramp("#efe3c4", "#d9c9a3", "#b8a57c", "#8c7a55"),
  sky: "#7fb4e0",
  wood: "#a8733e",
  steel: "#4a433d",
};

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
  // A filled mask, lit from the top left: top row and left column light, bottom row and
  // right column shaded. A flat colour string skips the shading.
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
  // Rows of [x0, x1] spans from y0 down.
  shape(y0, spans, r) {
    const m = new Set();
    spans.forEach(([a, b], j) => {
      for (let x = a; x <= b; x++) m.add(`${x},${y0 + j}`);
    });
    this.fill(m, r);
  }
  line(x0, y0, x1, y1, c, w = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      this.rect(x, y, w, w, c);
    }
  }
  // Draws a part with its own ink edge, so it separates from what it overlaps.
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
  mirror() {
    const out = new Array(S * S).fill(null);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) out[y * S + (S - 1 - x)] = this.px[y * S + x];
    this.px = out;
    return this;
  }
}

// --- the shared robot --------------------------------------------------------

function antenna(sp) {
  sp.rect(23, 4, 2, 4, C.body.l);
  sp.blob(22, 1, 4, 3, C.ember, 1);
}

const EYES = {
  open: (sp) => {
    sp.rect(19, 13, 2, 4, C.eye);
    sp.rect(27, 13, 2, 4, C.eye);
    sp.set(19, 13, C.eyeL);
    sp.set(27, 13, C.eyeL);
  },
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
  calm: (sp) => {
    sp.rect(19, 14, 2, 3, C.eye);
    sp.rect(27, 14, 2, 3, C.eye);
  },
  down: (sp) => {
    sp.rect(19, 16, 2, 2, C.eye);
    sp.rect(27, 16, 2, 2, C.eye);
  },
};

function faceFront(sp, eyes = "open") {
  sp.blob(16, 11, 16, 9, C.visor, 2);
  sp.rect(17, 12, 2, 1, C.visor.l);
  EYES[eyes](sp);
}

function faceSide(sp, eyes = "open") {
  sp.blob(27, 11, 8, 9, C.visor, 2);
  sp.set(28, 12, C.visor.l);
  if (eyes === "focused") sp.rect(31, 14, 3, 2, C.eye);
  else if (eyes === "happy") {
    sp.set(31, 15, C.eye);
    sp.rect(32, 14, 2, 1, C.eye);
  } else sp.rect(31, eyes === "calm" ? 14 : 13, 2, eyes === "calm" ? 3 : 4, C.eye);
}

// Arms hang at the sides; `hands` is the top row of the hands, so a costume with long
// sleeves can lower them.
function bodyFront(sp, { hands = 33 } = {}) {
  antenna(sp);
  sp.blob(13, 8, 22, 15, C.body, 3);
  sp.rect(21, 23, 6, 1, C.body.s);
  sp.blob(15, 24, 18, 13, C.body, 2);
  for (const [s, w, h] of [[12, 12, 11], [33, 34, 33]]) {
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

// Profile facing right. `legs` places the near and far foot for a walk.
function bodySide(sp, { legs = [21, 21], lift = [0, 0] } = {}) {
  const [near, far] = legs;
  const dy = sp.dy;
  sp.dy = 0;
  const leg = (x, up, r) => {
    sp.line(21, 36, x, 39 - up, r.b, 4);
    sp.blob(x - 1, 42 - up, 8, 4, r, 2);
  };
  leg(far, lift[1], { l: C.body.s, b: C.body.s, s: C.body.s });
  leg(near, lift[0], C.body);
  sp.dy = dy;
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

// --- the jobs ------------------------------------------------------------------
// Each job is { front, side, back }, each (sprite, options) => void, drawing the costume
// over the body it calls itself. `prop: false` leaves the hand empty.

const planner = {
  name: "planner",
  tube(sp, x0, y0, x1, y1) {
    sp.inked((t) => {
      t.line(x0, y0, x1, y1, C.sand.b, 3);
      t.line(x0, y0, x1, y1, C.sand.l, 1);
      t.rect(x0, y0, 3, 2, C.ember.b);
    });
  },
  cap(sp, view) {
    if (view === "side") {
      sp.shape(5, [[16, 31], [15, 32], [15, 32]], C.visor);
      sp.rect(15, 8, 19, 2, C.navy.b);
      sp.rect(15, 8, 19, 1, C.navy.l);
      sp.rect(27, 10, 11, 1, C.navy.d);
      sp.rect(30, 6, 2, 2, C.brass.b);
      return;
    }
    sp.shape(5, [[14, 33], [12, 35], [12, 35]], C.visor);
    sp.rect(13, 8, 22, 2, C.navy.b);
    sp.rect(13, 8, 22, 1, C.navy.l);
    if (view === "front") {
      sp.rect(15, 10, 18, 1, C.navy.d);
      sp.rect(22, 6, 4, 1, C.brass.b);
      sp.rect(23, 7, 2, 1, C.ember.b);
    }
  },
  coat: [...Array(6).fill([15, 32]), ...Array(5).fill([14, 33]), ...Array(4).fill([13, 34])],
  sleeves(sp, hands) {
    for (const x of [11, 33]) {
      sp.inked((s) => {
        s.shape(25, Array(hands - 26).fill([x, x + 3]), C.navy);
        s.rect(x, hands - 1, 4, 1, C.brass.b);
        s.blob(x, hands, 4, 3, C.body, 1);
      });
    }
  },
  epaulettes(sp) {
    sp.shape(23, [[14, 17], [13, 17], [13, 17]], C.brass);
    sp.shape(23, [[30, 33], [30, 34], [30, 34]], C.brass);
  },
  front(sp, { prop = true, eyes = "open", work = false } = {}) {
    planner.tube(sp, 9, 15, 30, 38);
    bodyFront(sp, { hands: 32 });
    faceFront(sp, eyes);
    sp.rect(16, 11, 16, 1, C.visor.s);
    planner.cap(sp, "front");
    sp.shape(24, planner.coat, C.navy);
    for (let y = 36; y <= 38; y++) for (const x of [23, 24]) sp.clear(x, y);
    sp.shape(24, [[20, 27], [21, 26], [22, 25], [23, 24]], C.visor.b);
    [[19, 24], [20, 25], [21, 26], [22, 27], [28, 24], [27, 25], [26, 26], [25, 27]].forEach(([x, y]) => sp.set(x, y, C.navy.l));
    sp.rect(23, 25, 2, 3, C.ember.b);
    for (const y of [29, 32, 35]) {
      sp.set(20, y, C.brass.l);
      sp.set(27, y, C.brass.l);
    }
    planner.epaulettes(sp);
    if (work) {
      planner.map(sp);
      return;
    }
    planner.sleeves(sp, 32);
    if (prop) {
      sp.inked((m) => {
        m.rect(35, 27, 3, 11, C.visor.b);
        m.rect(37, 27, 1, 11, C.visor.s);
        m.rect(35, 31, 3, 1, C.ember.b);
      });
      sp.inked((h) => h.blob(33, 32, 4, 3, C.body, 1));
    }
  },
  // The work pose: the map held open in both hands.
  map(sp) {
    for (const [x, hx] of [[11, 13], [33, 31]]) {
      sp.inked((s) => {
        s.shape(25, [[x, x + 3], [x, x + 3], [x, x + 3], [Math.min(x, hx), Math.max(x, hx) + 3]], C.navy);
        s.rect(hx, 29, 4, 1, C.brass.b);
      });
    }
    sp.inked((m) => {
      m.rect(13, 28, 22, 9, C.visor.b);
      m.rect(13, 28, 22, 1, C.visor.l);
      m.rect(13, 36, 22, 1, C.visor.s);
      m.rect(12, 27, 2, 11, C.sand.b);
      m.rect(34, 27, 2, 11, C.sand.b);
      m.line(15, 34, 22, 30, C.sky);
      m.line(22, 30, 31, 33, C.sky);
      m.rect(17, 30, 3, 2, C.mint.b);
      m.rect(26, 34, 3, 1, C.mint.b);
      m.line(28, 29, 30, 31, C.ember.b);
      m.line(30, 29, 28, 31, C.ember.b);
    });
    sp.inked((h) => {
      h.blob(11, 30, 3, 4, C.body, 1);
      h.blob(34, 30, 3, 4, C.body, 1);
    });
  },
  side(sp, { prop = true, step = 0 } = {}) {
    const walk = [
      { legs: [21, 21], lift: [0, 0], hand: [22, 32], tail: 0 },
      { legs: [26, 16], lift: [0, 0], hand: [26, 31], tail: 2 },
      { legs: [21, 19], lift: [0, 2], hand: [22, 32], tail: 1, bob: -1 },
      { legs: [16, 26], lift: [0, 0], hand: [18, 31], tail: 2 },
      { legs: [19, 21], lift: [2, 0], hand: [22, 32], tail: 1, bob: -1 },
    ][step];
    sp.dy = walk.bob ?? 0;
    planner.tube(sp, 12, 15, 15, 37);
    bodySide(sp, walk);
    faceSide(sp);
    sp.rect(27, 11, 8, 1, C.visor.s);
    planner.cap(sp, "side");
    const t = walk.tail;
    sp.shape(24, [...Array(6).fill([17, 30]), ...Array(5).fill([16, 31]), [15 - t, 31], [15 - t, 31], [14 - t, 31], [14 - t, 31]], C.navy);
    sp.rect(29, 24, 1, 4, C.navy.l);
    sp.rect(30, 24, 1, 2, C.visor.b);
    sp.rect(30, 25, 1, 3, C.ember.b);
    for (const y of [29, 32, 35]) sp.set(28, y, C.brass.l);
    sp.shape(23, [[20, 27], [19, 28]], C.brass);
    armSide(sp, {
      hand: walk.hand,
      sleeve: (a, hx, hy) => {
        a.blob(21, 25, 5, 4, C.navy, 1);
        if (hx === 22) a.rect(22, 28, 4, hy - 29, C.navy.b);
        else a.line(22, 28, hx, hy - 3, C.navy.b, 4);
        a.rect(hx, hy - 1, 4, 1, C.brass.b);
      },
    });
    if (prop && step === 0) {
      sp.inked((m) => {
        m.rect(23, 29, 3, 11, C.visor.b);
        m.rect(25, 29, 1, 11, C.visor.s);
        m.rect(23, 37, 3, 1, C.ember.b);
      });
      sp.inked((h) => h.blob(22, 32, 4, 3, C.body, 1));
    }
    sp.dy = 0;
  },
  back(sp, { prop = true } = {}) {
    bodyBack(sp, { hands: 32 });
    planner.cap(sp, "back");
    sp.shape(24, planner.coat, C.navy);
    for (let y = 36; y <= 38; y++) for (const x of [23, 24]) sp.clear(x, y);
    sp.rect(18, 24, 12, 2, C.navy.l);
    sp.rect(23, 27, 1, 10, C.navy.s);
    sp.rect(18, 31, 12, 1, C.navy.l);
    sp.set(18, 31, C.brass.l);
    sp.set(29, 31, C.brass.l);
    planner.epaulettes(sp);
    planner.sleeves(sp, 32);
    planner.tube(sp, 36, 15, 17, 38);
    if (prop) sp.inked((m) => m.rect(10, 27, 3, 6, C.visor.b));
  },
};

const developer = {
  name: "developer",
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
    developer.hem(sp, 14, 33);
    sp.shape(30, [[20, 27], [19, 28], [18, 29], [18, 29], [18, 29]], { l: C.mint.d, b: C.mint.s, s: C.mint.s });
    for (const x of [19, 28]) {
      sp.rect(x, 23, 1, 5, C.visor.b);
      sp.set(x, 28, C.visor.s);
    }
    developer.sleeves(sp);
    if (prop) {
      developer.mug(sp, 34, 32);
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
    developer.hem(sp, 16, 31);
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
      developer.mug(sp, 25, 32);
      sp.set(26, 30, C.visor.s);
      sp.set(27, 29, C.visor.s);
    }
  },
  back(sp, { prop = true } = {}) {
    bodyBack(sp, { hands: 34 });
    sp.shape(23, Array(13).fill([14, 33]), C.mint);
    developer.hem(sp, 14, 33);
    sp.blob(11, 6, 26, 18, C.mint, 4);
    sp.shape(22, [[16, 31], [17, 30], [18, 29], [20, 27]], C.mint);
    sp.rect(23, 8, 2, 17, C.mint.s);
    sp.rect(23, 8, 1, 17, C.mint.d);
    sp.rect(27, 29, 3, 3, C.ember.b);
    sp.set(28, 30, C.visor.b);
    developer.sleeves(sp);
    if (prop) sp.inked((m) => m.rect(9, 32, 2, 4, C.visor.b));
  },
};

const designer = {
  name: "designer",
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
    designer.beret(sp);
    sp.rect(16, 11, 16, 1, C.visor.s);
    sp.shape(23, designer.smock, C.lilac);
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
    designer.sleeves(sp);
    if (prop) designer.brush(sp, 35, 24, 35, 35);
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
    if (prop) designer.brush(sp, 24, 24, 24, 35);
    if (prop) sp.inked((h) => h.blob(22, 33, 4, 3, C.body, 1));
  },
  back(sp, { prop = true } = {}) {
    bodyBack(sp);
    designer.beret(sp, true);
    sp.shape(23, designer.smock, C.lilac);
    sp.line(18, 24, 28, 34, C.visor.b);
    sp.line(29, 24, 19, 34, C.visor.b);
    sp.shape(23, [[19, 28], [20, 27], [21, 26], [22, 25], [23, 24]], C.peach);
    sp.inked((b) => {
      b.shape(34, [[19, 21], [19, 22], [19, 21]], C.visor);
      b.shape(34, [[26, 28], [25, 28], [26, 28]], C.visor);
      b.rect(23, 35, 2, 1, C.visor.s);
      b.rect(21, 37, 1, 3, C.visor.b);
      b.rect(26, 37, 1, 3, C.visor.b);
    });
    sp.rect(17, 28, 2, 1, C.sky);
    designer.sleeves(sp);
    if (prop) sp.inked((b) => b.line(12, 24, 12, 31, C.wood));
  },
};

const archivist = {
  name: "archivist",
  shade(sp, view) {
    if (view === "side") {
      sp.rect(15, 9, 19, 2, C.mint.d);
      sp.shape(10, [[30, 35], [30, 37], [31, 38]], C.mint);
      return;
    }
    sp.rect(13, 9, 22, 2, C.mint.d);
    if (view === "front") sp.shape(11, [[13, 34], [12, 35]], C.mint);
    else sp.rect(23, 9, 2, 2, C.mint.l);
  },
  cardigan: Array(13).fill([15, 32]),
  sleeves(sp) {
    for (const x of [11, 33]) {
      sp.inked((s) => {
        s.shape(25, Array(7).fill([x, x + 3]), C.peach);
        s.rect(x, 32, 4, 1, C.peach.d);
        s.blob(x, 33, 4, 3, C.body, 1);
      });
    }
  },
  card(sp, x, y) {
    sp.inked((c) => {
      c.rect(x, y, 5, 4, C.visor.b);
      c.rect(x, y, 5, 1, C.ember.b);
      c.rect(x + 1, y + 2, 3, 1, C.visor.s);
      c.set(x + 4, y - 1, C.mint.b);
    });
  },
  front(sp, { prop = true } = {}) {
    sp.blob(11, 20, 26, 18, C.sand, 1);
    bodyFront(sp);
    faceFront(sp, "calm");
    for (const x of [18, 26]) {
      sp.rect(x, 13, 4, 1, C.steel);
      sp.rect(x, 17, 4, 1, C.steel);
      sp.rect(x, 13, 1, 5, C.steel);
      sp.rect(x + 3, 13, 1, 5, C.steel);
    }
    sp.rect(22, 14, 4, 1, C.steel);
    sp.set(20, 14, C.eyeL);
    sp.set(28, 14, C.eyeL);
    archivist.shade(sp, "front");
    sp.shape(23, archivist.cardigan, C.peach);
    sp.rect(15, 36, 18, 1, C.peach.d);
    sp.shape(23, [[20, 27], [21, 26], [22, 25], [23, 24]], C.visor.b);
    sp.rect(23, 27, 2, 9, C.peach.s);
    for (const y of [29, 32]) sp.rect(23, y, 2, 1, C.visor.b);
    sp.rect(17, 23, 2, 8, C.sand.d);
    sp.rect(29, 23, 2, 8, C.sand.d);
    sp.rect(17, 32, 4, 3, C.peach.s);
    sp.rect(27, 32, 4, 3, C.peach.s);
    sp.rect(18, 30, 2, 2, C.visor.b);
    sp.set(18, 30, C.mint.b);
    sp.rect(28, 30, 2, 2, C.visor.b);
    sp.set(29, 30, C.sky);
    archivist.sleeves(sp);
    if (prop) {
      archivist.card(sp, 34, 30);
      sp.inked((h) => h.blob(33, 33, 4, 3, C.body, 1));
    }
  },
  side(sp, { prop = true } = {}) {
    sp.blob(7, 19, 10, 20, C.sand, 1);
    for (const [y, c] of [[20, C.mint.b], [26, C.sky], [32, C.ember.b]]) {
      sp.rect(7, y + 5, 3, 1, C.sand.d);
      sp.set(7, y + 1, c);
      sp.rect(6, y + 3, 1, 1, C.steel);
    }
    bodySide(sp);
    faceSide(sp, "calm");
    sp.rect(30, 13, 4, 1, C.steel);
    sp.rect(30, 17, 4, 1, C.steel);
    sp.rect(30, 13, 1, 5, C.steel);
    sp.rect(26, 14, 4, 1, C.steel);
    archivist.shade(sp, "side");
    sp.shape(23, Array(13).fill([17, 30]), C.peach);
    sp.rect(17, 36, 14, 1, C.peach.d);
    sp.rect(29, 23, 2, 3, C.visor.b);
    sp.rect(18, 23, 2, 12, C.sand.d);
    sp.rect(27, 32, 3, 3, C.peach.s);
    armSide(sp, {
      sleeve: (a) => {
        a.shape(25, Array(7).fill([22, 25]), C.peach);
        a.rect(22, 32, 4, 1, C.peach.d);
      },
    });
    if (prop) {
      archivist.card(sp, 24, 30);
      sp.inked((h) => h.blob(22, 33, 4, 3, C.body, 1));
    }
  },
  back(sp, { prop = true } = {}) {
    bodyBack(sp);
    archivist.shade(sp, "back");
    sp.shape(23, archivist.cardigan, C.peach);
    sp.rect(15, 36, 18, 1, C.peach.d);
    archivist.sleeves(sp);
    sp.inked((k) => {
      k.blob(12, 19, 24, 19, C.sand, 1);
      for (const [y, c] of [[20, C.mint.b], [26, C.sky], [32, C.ember.b]]) {
        if (y > 20) k.rect(13, y - 1, 22, 1, C.sand.d);
        k.rect(20, y + 1, 8, 2, C.visor.b);
        k.rect(20, y + 1, 1, 2, c);
        k.rect(21, y + 4, 6, 1, C.steel);
      }
    });
    if (prop) sp.inked((c) => c.rect(10, 31, 2, 3, C.visor.b));
  },
};

const JOBS = [planner, developer, designer, archivist];

// --- output --------------------------------------------------------------------

const draw = (fn) => {
  const sp = new Sprite();
  fn(sp);
  return sp.outline();
};

function png(sp) {
  const w = S;
  const raw = Buffer.alloc((w * 4 + 1) * w);
  for (let y = 0; y < w; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const c = sp.px[y * S + x];
      if (!c) continue;
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = parseInt(c.slice(1, 3), 16);
      raw[o + 1] = parseInt(c.slice(3, 5), 16);
      raw[o + 2] = parseInt(c.slice(5, 7), 16);
      raw[o + 3] = 255;
    }
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
  ihdr.writeUInt32BE(w, 4);
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

const dir = join(dirname(fileURLToPath(import.meta.url)), "png");
mkdirSync(dir, { recursive: true });
const out = (name, sp) => writeFileSync(join(dir, `${name}.png`), png(sp));
for (const job of JOBS) {
  for (const view of ["front", "side", "back"]) {
    out(`${job.name}-${view}`, draw((sp) => job[view](sp)));
    if (view !== "side") out(`${job.name}-${view}-noprop`, draw((sp) => job[view](sp, { prop: false })));
  }
}
for (let step = 1; step <= 4; step++) out(`planner-walk-${step}`, draw((sp) => planner.side(sp, { step })));
out("planner-work", draw((sp) => planner.front(sp, { work: true, eyes: "down" })));
out("planner-side-left", draw((sp) => planner.side(sp)).mirror());
