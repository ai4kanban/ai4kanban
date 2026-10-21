import type { CSSProperties, ReactNode } from "react";
import { FiX } from "react-icons/fi";
import { CROP, NB, Panel, Shot, em } from "./nb";

// Step 03 推进执行 — the Runs dialog, which opens on the agent office. Mirrors
// kanban-ui/components/sessions.tsx (`RunsOffice`) and `RunScene.tsx`: one bot
// per running job, each at its own desk with the screen it works at awake, the
// two jobs that just passed resting on the sofa, and the strip along the bottom
// carrying the two ways into the records, the count being the first of them
// (#781). Every pixel of the dialog's interior is the room — it has no header
// and no list.
//
// The room is the app's own art, flattened by `scripts/build-office-art.mjs`
// with its panes left open, which also cuts each costume's frames and the views
// out of the window; the view, the clock's hands and the bots are drawn here, at
// the world coordinates kanban-ui/lib/run-scene.ts places them at.
//
// Still everywhere but the homepage, which passes `live`: the clock and the view
// follow the reader's own time, and one 18-second loop of traffic plays — the
// older sofa bot walks out, desk 5's copywriter finishes and takes the sofa, a
// new one walks in to desk 5. It ends on the frame it opens on, the card ids
// one step on.
//
// Drawn without the board behind it. The real dialog floats on a scrim over the
// board, and half a blurred board bleeding off the edges reads as a screen grab
// rather than the artwork this is mounted as.

/** run-scene.ts's world — every coordinate below is in its pixels. */
const WORLD = { w: 1536, h: 1024 };

/** What the dialog's shape takes off the ceiling. The real camera covers its
 *  interior and crops the top by up to 40; this shape wants 20, and the last
 *  pixel or two of floor goes at the bottom. */
const TOP_CROP = 20;

/** `BOT_HEIGHT`, and the share of the sprite above its ground line. */
const BOT = 115;
const GROUND = 46 / 48;

/** The nameplates, in world pixels from the bot's feet: who is at this desk
 *  above its head, the card it is on below its feet. A worker's plate has to
 *  clear the screen it is standing at, which is higher than the real scene's
 *  128; a bot on the sofa has nothing in front of it, and its plate sits just
 *  over its head — the seated sprite's is a third of a standing one's up. */
const ABOVE = 139;
const SEATED_ABOVE = 86;
const BELOW = 3;
/** How far each sofa plate leans away from its neighbour, so the two clear. */
const SOFA_SPREAD = 10;

const DESK_X = [345, 665, 980, 1302];
const ROW_Y = [481, 716];

type Spot = { x: number; y: number };

const px = (v: number, of: number) => `${(v / of) * 100}%`;

/** Where a desk's worker stands (`deskSpot`, solo), back row then front. */
const DESK_SPOTS: Spot[] = [
  ...DESK_X.map((x) => ({ x, y: ROW_Y[0] })),
  ...DESK_X.map((x) => ({ x, y: ROW_Y[1] })),
];
const SOFA_SPOTS: Spot[] = [
  { x: 1155, y: 901 },
  { x: 1280, y: 901 },
];
/** `walkPath`: the aisle along the bottom, and the door at its left end. */
const AISLE = 975;
const DOOR = 40;

/** Where the window art goes: the glass `build-office-art.mjs` crops it to, at
 *  each window (`SCENERY`), and the cloud band (`CLOUDS`). */
const WINDOWS = [264, 879];
const GLASS = { x: 20, y: 24, w: 354, h: 133 };
const CLOUDS = { y: 24, w: 394, h: 48, speed: 1.2 };
const CLOCK = { x: 732, y: 52, w: 72 };

/** bots.webp's rows, one costume each — `LOOKS` in build-office-art.mjs. */
const LOOKS = ["builder", "ui-designer", "software-planner", "copywriting", "illustrator"];

type Job = {
  look: string;
  /** The role's name in the app's English UI. */
  role: string;
  card: number;
  /** The connector's mark, from web/public/agents/. */
  agent: string;
};

// Six jobs running at six desks, and the two latest to pass on the sofa. The
// still's screens are awake at exactly these six desks, each showing its
// worker's job — move or recast a worker and the art has to be rebuilt with it.
const CAST: (Job & { desk?: number; seat?: number })[] = [
  { look: "builder", role: "Builder", card: 374, agent: "claude", desk: 0 },
  { look: "builder", role: "Builder", card: 357, agent: "codex", desk: 1 },
  { look: "ui-designer", role: "UI designer", card: 378, agent: "claude", desk: 2 },
  { look: "builder", role: "Builder", card: 388, agent: "cursor", desk: 3 },
  { look: "software-planner", role: "Software planner", card: 391, agent: "claude", desk: 4 },
  { look: "copywriting", role: "Copywriting", card: 362, agent: "opencode", desk: 5 },
  { look: "builder", role: "Builder", card: 369, agent: "codex", seat: 0 },
  { look: "illustrator", role: "Illustrator", card: 341, agent: "claude", seat: 1 },
];

const RUNNING = CAST.filter((b) => b.desk !== undefined).length;

// --- the homepage's loop -------------------------------------------------------

/** One loop, in seconds, and walking speed in world pixels a second. */
const LOOP = 18;
const SPEED = 300;

type Pose = "type" | "walk" | "sit";
type Leg = Spot & { at: number; pose: Pose; left?: boolean; gone?: boolean };

/** Walk `to` from `from`, starting at `start`. The sprite faces right, so a leg
 *  heading left is mirrored from its first step; a vertical leg keeps the facing
 *  it has, the first one taking the path's first sideways direction. */
function walk(start: number, from: Spot, to: Spot[]): Leg[] {
  const side = (p: Spot, q: Spot) => (q.x === p.x ? undefined : q.x < p.x);
  let left = to.map((q, i) => side(i ? to[i - 1] : from, q)).find((v) => v !== undefined) ?? false;
  const legs: Leg[] = [];
  let t = start;
  let p = from;
  for (const q of to) {
    left = side(p, q) ?? left;
    legs.push({ at: t, ...p, pose: "walk", left });
    t += Math.hypot(q.x - p.x, q.y - p.y) / SPEED;
    p = q;
  }
  // Arrived: out of the door, or into the seat or desk it walked to.
  const sofa = to.at(-1)!.y === SOFA_SPOTS[0].y;
  legs.push(p.x === DOOR ? { at: t, ...p, pose: "walk", left, gone: true } : { at: t, ...p, pose: sofa ? "sit" : "type" });
  return legs;
}

const SOFA_LEFT = SOFA_SPOTS[0];
const DESK_5 = DESK_SPOTS[5];
const COPY = { look: "copywriting", role: "Copywriting", agent: "opencode" };

/** The three who move, each a timeline from the loop's start. The card each
 *  carries is the `n`th of `cardAt`, `n` counting on by one a loop: the
 *  arrival's card is the one desk 5 shows next loop, and so on to the sofa. */
const MOVERS: { id: string; n: number; legs: Leg[] }[] = [
  {
    id: "leaver",
    n: 0,
    legs: [{ at: 0, ...SOFA_LEFT, pose: "sit" }, ...walk(2, SOFA_LEFT, [{ x: SOFA_LEFT.x, y: AISLE }, { x: DOOR, y: AISLE }])],
  },
  {
    id: "finisher",
    n: 1,
    legs: [
      { at: 0, ...DESK_5, pose: "type" },
      ...walk(7, DESK_5, [{ x: DESK_5.x, y: AISLE }, { x: SOFA_LEFT.x, y: AISLE }, SOFA_LEFT]),
    ],
  },
  {
    id: "arrival",
    n: 2,
    legs: [
      { at: 0, x: DOOR, y: AISLE, pose: "walk", gone: true },
      ...walk(10, { x: DOOR, y: AISLE }, [{ x: DESK_5.x, y: AISLE }, DESK_5]),
    ],
  },
];
const cardAt = (n: number) => (n < 2 ? [349, 362][n] : 395 + (n - 2) * 7);

/** Who stays put on the homepage: desks 0–4 as in the still, and a builder on
 *  the sofa's right seat. */
const STILL = [...CAST.filter((b) => b.desk !== undefined && b.desk < 5), { ...CAST[6], seat: 1 }];

const pc = (t: number) => `${((t / LOOP) * 100).toFixed(3)}%`;
const lean = (l: Spot & { pose?: Pose }) => (l.pose === "sit" && l.x === SOFA_LEFT.x ? -SOFA_SPREAD : 0);

/** One mover's keyframes: its sprite and two plates gliding between points, and
 *  its pose, facing and presence held from one point to the next. */
function keyframes(id: string, legs: Leg[]) {
  const ends = [...legs, { ...legs.at(-1)!, at: LOOP }];
  const glide = (name: string, dx: (l: Leg) => number, dy: (l: Leg) => number) =>
    `@keyframes ${name}{${ends
      .map((l) => `${pc(l.at)}{left:${px(l.x + dx(l), WORLD.w)};top:${px(l.y + dy(l), WORLD.h)}}`)
      .join("")}}`;
  const hold = (name: string, value: (l: Leg) => string) =>
    `@keyframes ${name}{${ends
      .map((l, i) => (i ? `${pc(l.at - 0.005)}{${value(ends[i - 1])}}` : "") + `${pc(l.at)}{${value(l)}}`)
      .join("")}}`;
  return [
    glide(`of-${id}-bot`, () => 0, () => -BOT * GROUND),
    glide(`of-${id}-up`, lean, (l) => -(l.pose === "sit" ? SEATED_ABOVE : ABOVE)),
    glide(`of-${id}-down`, lean, () => BELOW),
    hold(`of-${id}-on`, (l) => `opacity:${l.gone ? 0 : 1}`),
    hold(`of-${id}-face`, (l) => `transform:scaleX(${l.left ? -1 : 1})`),
    ...(["type", "walk", "sit"] as Pose[]).map((p) => hold(`of-${id}-${p}`, (l) => `opacity:${l.pose === p ? 1 : 0}`)),
  ].join("\n");
}

const loop = (name: string) => `${name} ${LOOP}s linear infinite both`;

// --- sprites ---------------------------------------------------------------

// Each row of the sheet: four typing frames, four walking ones, then the seated one.
const FRAMES = 9;
const TYPE_MS = 640;
const frameX = (i: number) => `${(i / (FRAMES - 1)) * 100}%`;

const MOTION = `
@keyframes ex-type { from { background-position-x: 0% } to { background-position-x: ${frameX(4)} } }
@keyframes ex-walk { from { background-position-x: ${frameX(4)} } to { background-position-x: 100% } }
@keyframes ex-drift { from { transform: translateX(0) } to { transform: translateX(50%) } }
@media (prefers-reduced-motion: no-preference) {
  /* Six agents that started at six different moments don't type in lockstep. */
  .ex-type { animation: ex-type ${TYPE_MS}ms steps(4) var(--d, 0s) infinite both }
  .ex-drift { animation: ex-drift ${CLOUDS.w / CLOUDS.speed}s linear infinite }
}
`;

const LIVE_MOTION = `
@media (prefers-reduced-motion: no-preference) {
${MOVERS.map((m) => keyframes(m.id, m.legs)).join("\n")}
${MOVERS.map(
  (m) => `.of-${m.id}-bot { animation: ${loop(`of-${m.id}-bot`)}, ${loop(`of-${m.id}-on`)} }
.of-${m.id}-up { animation: ${loop(`of-${m.id}-up`)}, ${loop(`of-${m.id}-on`)} }
.of-${m.id}-down { animation: ${loop(`of-${m.id}-down`)}, ${loop(`of-${m.id}-on`)} }
.of-${m.id}-face { animation: ${loop(`of-${m.id}-face`)} }
.of-${m.id}-type { animation: ex-type ${TYPE_MS}ms steps(4) infinite both, ${loop(`of-${m.id}-type`)} }
.of-${m.id}-walk { animation: ex-walk ${TYPE_MS}ms steps(4) infinite both, ${loop(`of-${m.id}-walk`)} }
.of-${m.id}-sit { animation: ${loop(`of-${m.id}-sit`)} }`,
).join("\n")}
}
`;

/** One costume's sprite, filling the box it is put in, on the frame `pose`
 *  starts at. */
function Sprite({ look, pose, className, style }: { look: string; pose: Pose; className?: string; style?: CSSProperties }) {
  return (
    <span
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "url(/run-scene/bots.webp)",
        backgroundSize: `${FRAMES * 100}% ${LOOKS.length * 100}%`,
        backgroundPositionX: frameX(pose === "type" ? 0 : pose === "walk" ? 4 : FRAMES - 1),
        backgroundPositionY: px(LOOKS.indexOf(look), LOOKS.length - 1),
        imageRendering: "pixelated",
        ...style,
      }}
    />
  );
}

/** A bot's two plates: its role and connector over its head, its card under its feet. */
function Plates({
  job,
  spot,
  sitting,
  lean = 0,
  className,
  hidden,
}: {
  job: Job;
  spot: Spot;
  sitting?: boolean;
  /** In world pixels. */
  lean?: number;
  /** A mover's: the class carrying its keyframes, ending `-up` or `-down`. */
  className?: string;
  hidden?: boolean;
}) {
  // The sofa seats two a desk's width apart, so its plates are set a size down
  // to keep a gap between them.
  const F = sitting ? 8.5 : 9.5;
  return (
    <>
      <Plate
        spot={{ x: spot.x + lean, y: spot.y - (sitting ? SEATED_ABOVE : ABOVE) }}
        size={F}
        lift
        className={className && `${className}-up`}
        hidden={hidden}
      >
        <span style={{ fontWeight: 600 }}>{job.role}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/agents/${job.agent}.svg`}
          alt=""
          style={{ width: em(9, F), height: em(9, F), flex: "0 0 auto" }}
        />
      </Plate>
      <Plate
        spot={{ x: spot.x + lean, y: spot.y + BELOW }}
        size={F - 0.5}
        className={className && `${className}-down`}
        hidden={hidden}
      >
        #{job.card}
      </Plate>
    </>
  );
}

const botBox = (spot: Spot): CSSProperties => ({
  position: "absolute",
  left: px(spot.x, WORLD.w),
  top: px(spot.y - BOT * GROUND, WORLD.h),
  width: px(BOT, WORLD.w),
  marginLeft: px(-BOT / 2, WORLD.w),
  aspectRatio: "1",
});

/** One bot that stays put: at its desk typing, or seated on the sofa. */
function Bot({ job, spot, sitting, lean, delay }: { job: Job; spot: Spot; sitting?: boolean; lean?: number; delay: number }) {
  return (
    <>
      <span style={botBox(spot)}>
        <Sprite
          look={job.look}
          pose={sitting ? "sit" : "type"}
          className={sitting ? undefined : "ex-type"}
          style={{ "--d": `${delay}ms` } as CSSProperties}
        />
      </span>
      <Plates job={job} spot={spot} sitting={sitting} lean={lean} />
    </>
  );
}

/** One of the loop's movers, drawn as it opens the loop — which is also where
 *  it stays with reduced motion. Its keyframes carry it from there. */
function Mover({ id, legs, job }: { id: string; legs: Leg[]; job: Job }) {
  const first = legs[0];
  const sitting = first.pose === "sit";
  return (
    <>
      <span className={`of-${id}-bot`} style={{ ...botBox(first), opacity: first.gone ? 0 : 1 }}>
        <span className={`of-${id}-face`} style={{ position: "absolute", inset: 0 }}>
          {(["type", "walk", "sit"] as Pose[]).map((p) => (
            <Sprite key={p} look={job.look} pose={p} className={`of-${id}-${p}`} style={{ opacity: p === first.pose ? 1 : 0 }} />
          ))}
        </span>
      </span>
      <Plates job={job} spot={first} sitting={sitting} lean={lean(first)} className={`of-${id}`} hidden={first.gone} />
    </>
  );
}

/** A nameplate: paper under the words, so they stay readable over the room.
 *  `lift` hangs it by its underside, which is what keeps it off the bot's head
 *  at a type size drawn larger than the room's own scale. */
function Plate({
  spot,
  size,
  lift,
  className,
  hidden,
  children,
}: {
  spot: Spot;
  size: number;
  lift?: boolean;
  className?: string;
  hidden?: boolean;
  children: ReactNode;
}) {
  const F = size;
  return (
    <span
      className={className}
      style={{
        position: "absolute",
        left: px(spot.x, WORLD.w),
        top: px(spot.y, WORLD.h),
        transform: `translate(-50%, ${lift ? "-100%" : "0"})`,
        display: "flex",
        alignItems: "center",
        gap: em(3, F),
        borderRadius: em(3, F),
        padding: `${em(1, F)} ${em(4, F)}`,
        background: "color-mix(in srgb, #ffffff 92%, transparent)",
        fontSize: em(F),
        lineHeight: em(14, F),
        whiteSpace: "nowrap",
        color: NB.ink,
        opacity: hidden ? 0 : 1,
      }}
    >
      {children}
    </span>
  );
}

/** `.nb-chip-px` — the square ink frame everything loose over the room wears:
 *  a 2px line, a 2px corner and a hard shadow. `own` is the font-size of the
 *  element it lands on. */
const pxBox = (own?: number): CSSProperties => ({
  border: `${em(2, own)} solid ${NB.ink}`,
  borderRadius: em(2, own),
  background: NB.paper,
  boxShadow: `${em(3, own)} ${em(3, own)} 0 0 ${NB.ink}`,
});

/** One way into the records, on the bottom strip: the shared button at
 *  `size="xs"`, squared off to the room's own weight. */
function Entrance({ children }: { children: ReactNode }) {
  const F = 12;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: em(28, F),
        padding: `0 ${em(10, F)}`,
        fontSize: em(F),
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
        color: NB.ink,
        ...pxBox(F),
      }}
    >
      {children}
    </span>
  );
}

export type Period = "dawn" | "day" | "dusk" | "night";

/** What the room shows of the time: the view out, and each hand's turn in
 *  degrees clockwise from noon. */
export type OfficeTime = { period: Period; hour: number; minute: number };

/** The still's: daylight, ten past ten. */
const STILL_TIME: OfficeTime = { period: "day", hour: 305, minute: 60 };

/** The city through both windows with its clouds drifting over, under the
 *  room's open panes. */
function Outlook({ period }: { period: Period }) {
  return WINDOWS.map((x) => (
    <span
      key={x}
      style={{
        position: "absolute",
        left: px(x + GLASS.x, WORLD.w),
        top: px(GLASS.y, WORLD.h),
        width: px(GLASS.w, WORLD.w),
        height: px(GLASS.h, WORLD.h),
        overflow: "hidden",
        backgroundImage: `url(/run-scene/window-${period}.webp)`,
        backgroundSize: "100% 100%",
      }}
    >
      {/* Two tiles wide, one tile left of where the app's band starts, and
          drifting one tile right: the same sky at both ends. */}
      <span
        className="ex-drift"
        style={{
          position: "absolute",
          left: `${((-CLOUDS.w - GLASS.x) / GLASS.w) * 100}%`,
          top: `${((CLOUDS.y - GLASS.y) / GLASS.h) * 100}%`,
          width: `${((2 * CLOUDS.w) / GLASS.w) * 100}%`,
          height: `${(CLOUDS.h / GLASS.h) * 100}%`,
          backgroundImage: `url(/run-scene/clouds-${period}.webp)`,
          backgroundSize: "50% 100%",
          backgroundRepeat: "repeat-x",
        }}
      />
    </span>
  ));
}

function Hands({ hour, minute }: { hour: number; minute: number }) {
  return (
    <svg
      viewBox="0 0 72 72"
      style={{
        position: "absolute",
        left: px(CLOCK.x, WORLD.w),
        top: px(CLOCK.y, WORLD.h),
        width: px(CLOCK.w, WORLD.w),
        height: px(CLOCK.w, WORLD.h),
      }}
    >
      <g transform="translate(36,36)">
        <g transform={`rotate(${hour})`}>
          <rect x="-2.4" y="-16" width="4.8" height="19" rx="2" fill="#c8501d" />
        </g>
        <g transform={`rotate(${minute})`}>
          <rect x="-1.8" y="-24" width="3.6" height="27" rx="1.8" fill="#c8501d" />
        </g>
        <circle r="2.6" fill="#3a3936" />
      </g>
    </svg>
  );
}

export function ShotSessions({
  live,
}: {
  /** The homepage's: the reader's time (unknown until the page is running), and
   *  how many loops have played, told by `onRound` as each one ends. */
  live?: { time: OfficeTime | null; round: number; onRound: () => void };
}) {
  const time = live ? live.time : STILL_TIME;
  return (
    <Shot crop={CROP} fade={false}>
      <div style={{ padding: em(14) }}>
        <style>{MOTION}</style>
        {live && <style>{LIVE_MOTION}</style>}
        {/* .nb-panel — the dialog frame, and the room fills it. */}
        <Panel style={{ position: "relative", overflow: "hidden" }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: `${WORLD.w} / ${WORLD.h - TOP_CROP}`,
              overflow: "hidden",
            }}
          >
            {/* The room, hung by the ceiling the crop leaves. Everything in it
                is placed as a share of this box, so the office and its bots
                scale together at every width. */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%",
                // A margin, not `top`: a percentage here is read off the width,
                // which is the only length this box's own scale comes from.
                marginTop: px(-TOP_CROP, WORLD.w),
                aspectRatio: `${WORLD.w} / ${WORLD.h}`,
                imageRendering: "pixelated",
              }}
              onAnimationIteration={live && ((e) => e.animationName === "of-leaver-bot" && live.onRound())}
            >
              {time && <Outlook period={time.period} />}
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: "url(/run-scene/office.webp)",
                  backgroundSize: "100% 100%",
                }}
              />
              {time && <Hands hour={time.hour} minute={time.minute} />}
              {(live ? STILL : CAST).map((b, i) => (
                <Bot
                  key={b.card}
                  job={b}
                  spot={b.desk !== undefined ? DESK_SPOTS[b.desk] : SOFA_SPOTS[b.seat!]}
                  sitting={b.desk === undefined}
                  lean={b.seat === undefined ? 0 : (b.seat * 2 - 1) * SOFA_SPREAD}
                  delay={-97 * i}
                />
              ))}
              {live &&
                MOVERS.map((m) => (
                  <Mover key={m.id} id={m.id} legs={m.legs} job={{ ...COPY, card: cardAt(live.round + m.n) }} />
                ))}
            </div>
          </div>

          {/* The dialog's own chrome, over the room: the way out, and the strip
              carrying the two ways into the records. Both are pixel boxes — the
              room's own line weight, not the board's rounded chrome (#760). */}
          <span
            style={{
              position: "absolute",
              right: em(12),
              top: em(12),
              display: "grid",
              placeItems: "center",
              width: em(28),
              height: em(28),
              color: NB.ink,
              ...pxBox(),
            }}
          >
            <FiX aria-hidden style={{ width: em(18), height: em(18) }} />
          </span>
          <span
            style={{
              position: "absolute",
              left: em(16),
              bottom: em(16),
              display: "flex",
              alignItems: "center",
              gap: em(8),
            }}
          >
            {/* The count is an entrance too, and wears the same box as the one
                beside it. Drawn resting: neither drawer is up. */}
            <Entrance>{RUNNING} running</Entrance>
            <Entrance>Completed</Entrance>
          </span>
        </Panel>
      </div>
    </Shot>
  );
}
