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
// The room is the app's own art, flattened to one still by
// `scripts/build-office-art.mjs`; the bots and everything over them are drawn
// here, at the world coordinates kanban-ui/lib/run-scene.ts places them at.
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
const GROUND = 285 / 300;

/** The nameplates, in world pixels from the bot's feet: who is at this desk
 *  above its head, the card it is on below its feet. A worker's plate has to
 *  clear the screen it is standing at, which is higher than the real scene's
 *  128; a bot on the sofa has nothing in front of it, and its plate sits just
 *  over its head — the seated sprite's is a third of a standing one's up. */
const ABOVE = 139;
const SEATED_ABOVE = 86;
const BELOW = 3;

const DESK_X = [345, 665, 980, 1302];
const ROW_Y = [481, 716];

/** Where a desk's worker stands (`deskSpot`, solo), back row then front. */
const DESK_SPOTS = [
  ...DESK_X.map((x) => ({ x, y: ROW_Y[0] })),
  ...DESK_X.map((x) => ({ x, y: ROW_Y[1] })),
];
const SOFA_SPOTS = [
  { x: 1155, y: 901 },
  { x: 1280, y: 901 },
];

// Six jobs running at six desks, and the two latest to pass on the sofa. The
// still's screens are awake at exactly these six desks — move a worker and the
// art has to be rebuilt with it.
const CAST: {
  role: string;
  card: number;
  /** The connector's mark, from web/public/agents/. */
  agent: string;
  desk?: number;
  seat?: number;
}[] = [
  { role: "Builder", card: 374, agent: "claude", desk: 0 },
  { role: "Builder", card: 357, agent: "codex", desk: 1 },
  { role: "Reviewer", card: 378, agent: "claude", desk: 2 },
  { role: "Builder", card: 388, agent: "cursor", desk: 3 },
  { role: "Planner", card: 391, agent: "claude", desk: 4 },
  { role: "Writer", card: 362, agent: "opencode", desk: 5 },
  { role: "Reviewer", card: 369, agent: "codex", seat: 0 },
  { role: "Builder", card: 341, agent: "claude", seat: 1 },
];

const RUNNING = CAST.filter((b) => b.desk !== undefined).length;

// The sprite sheet: four typing frames, then the seated one.
const FRAMES = 5;
const TYPE_MS = 640;

const MOTION = `
@keyframes ex-type {
  from { background-position-x: 0% }
  to { background-position-x: 100% }
}
@media (prefers-reduced-motion: no-preference) {
  /* Six agents that started at six different moments don't type in lockstep. */
  .ex-type { animation: ex-type ${TYPE_MS}ms steps(4) var(--d, 0s) infinite both }
}
`;

const px = (v: number, of: number) => `${(v / of) * 100}%`;

/** One bot, its sprite and its two plates, at the spot the scene stands it on. */
function Bot({
  role,
  card,
  agent,
  spot,
  sitting,
  delay,
}: {
  role: string;
  card: number;
  agent: string;
  spot: { x: number; y: number };
  sitting?: boolean;
  delay: number;
}) {
  // The sofa seats two a desk's width apart, so its plates are set a size down
  // to keep a gap between them.
  const F = sitting ? 8.5 : 9.5;
  return (
    <>
      <span
        className={sitting ? undefined : "ex-type"}
        style={
          {
            position: "absolute",
            left: px(spot.x - BOT / 2, WORLD.w),
            top: px(spot.y - BOT * GROUND, WORLD.h),
            width: px(BOT, WORLD.w),
            aspectRatio: "1",
            backgroundImage: "url(/run-scene/bots.webp)",
            backgroundSize: `${FRAMES * 100}% 100%`,
            // The seated frame is the sheet's last; a worker starts on its first.
            backgroundPositionX: sitting ? "100%" : "0%",
            imageRendering: "pixelated",
            "--d": `${delay}ms`,
          } as CSSProperties
        }
      />
      <Plate spot={{ x: spot.x, y: spot.y - (sitting ? SEATED_ABOVE : ABOVE) }} size={F} lift>
        <span style={{ fontWeight: 600 }}>{role}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/agents/${agent}.svg`}
          alt=""
          style={{ width: em(9, F), height: em(9, F), flex: "0 0 auto" }}
        />
      </Plate>
      <Plate spot={{ x: spot.x, y: spot.y + BELOW }} size={F - 0.5}>
        #{card}
      </Plate>
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
  children,
}: {
  spot: { x: number; y: number };
  size: number;
  lift?: boolean;
  children: ReactNode;
}) {
  const F = size;
  return (
    <span
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

export function ShotSessions() {
  return (
    <Shot crop={CROP} fade={false}>
      <div style={{ padding: em(14) }}>
        <style>{MOTION}</style>
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
                backgroundImage: "url(/run-scene/office.webp)",
                backgroundSize: "100% 100%",
                imageRendering: "pixelated",
              }}
            >
              {CAST.map((b, i) => (
                <Bot
                  key={b.card}
                  role={b.role}
                  card={b.card}
                  agent={b.agent}
                  spot={b.desk !== undefined ? DESK_SPOTS[b.desk] : SOFA_SPOTS[b.seat!]}
                  sitting={b.desk === undefined}
                  delay={-97 * i}
                />
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
