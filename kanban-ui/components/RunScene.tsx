"use client";

// The office the Runs dialog opens on (#399).
//
// PixiJS draws the room and the robots; the names, the marks and the focus targets are DOM
// over the canvas, so a bot is reachable by keyboard and reads as what it is to a screen
// reader. The engine below owns positions and frames and writes them straight onto the
// sprite and its node — React re-renders only when the cast changes, never per frame.
//
// Pixi is imported lazily, so its renderer is code-split out of the board's first load.
// Anything that stops the scene being drawn — no GPU, no art, no renderer at all — answers
// `onUnavailable`, and the dialog goes back to its list-and-log form.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Application, Container, Sprite, Spritesheet, Texture, TilingSprite } from "pixi.js";
import { installedAgentsAction } from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import {
  ART,
  BOT_GROUND,
  BOT_HEIGHT,
  CLOCK,
  CLOUDS,
  DESK,
  DESKS,
  DESK_AT,
  DESK_FRAME_MS,
  PAIR_OFFSET,
  PLATE_ABOVE,
  PLATE_BELOW,
  SCENERY,
  SCENERY_ART,
  fitCamera,
  handAngles,
  periodAt,
  untilNextMinute,
  walkPath,
  WORLD,
  type Period,
  type SceneBot,
  type Spot,
} from "@/lib/run-scene";

const ATLAS = "/run-scene/bot-actions.json";
const PERIODS: Period[] = ["dawn", "day", "dusk", "night"];

/** The clock's two hands, and the pin they turn on. */
const HAND = "#c8501d";
const PIN = "#3a3936";

/** The ink every nameplate's text is drawn in. */
const INK = "#24231f";
/** World pixels a second, walking. */
const WALK = 420;
/** One frame of a four-frame cycle. */
const FRAME_MS = 160;
/** How much of the square sprite the robot actually fills. The focus target is the robot,
 *  not the empty air around it, so two paired bots never fight for a click. */
const BODY = 0.55;
const TALL = 0.92;

type Act = "type" | "sit" | "walk-left" | "walk-right";

interface Actor {
  bot: SceneBot;
  x: number;
  y: number;
  /** Where it still has to walk. Empty once it is where it belongs. */
  path: Spot[];
  /** On its way out: dropped from the cast when the path runs out. */
  leaving: boolean;
  act: Act;
  /** Fractional and seeded per bot, so they never type in lockstep. */
  frame: number;
  sprite?: Sprite;
  node?: HTMLButtonElement | null;
}

interface View {
  scale: number;
  ox: number;
  oy: number;
}

/** A connector's name and the mark that stands for it. */
interface Mark {
  label: string;
  icon: string;
}

/** The DOM id of one bot's focus target, so the dialog can put focus back on the bot a
 *  drawer was opened from. */
export const botTargetId = (jobId: string) => `run-bot-${jobId}`;

export function RunScene({
  bots,
  room,
  selected,
  onPick,
  onFloor,
  onUnavailable,
}: {
  /** Every bot in the office, across all its rooms. */
  bots: SceneBot[];
  /** The room on screen. Bots in the others are neither drawn nor stepped. */
  room: number;
  /** The job whose log is open, marked in the room. */
  selected: string | null;
  onPick: (bot: SceneBot) => void;
  /** Bare floor was clicked — the dialog takes this as "put the drawers away". */
  onFloor: () => void;
  onUnavailable: () => void;
}) {
  const c = useCopy().runs.scene;
  const canvasBox = useRef<HTMLDivElement>(null);
  const actors = useRef<Map<string, Actor>>(new Map());
  const view = useRef<View>({ scale: 1, ox: 0, oy: 0 });
  const stage = useRef<{
    sheet: Spritesheet;
    layer: Container;
    make: () => Sprite;
    /** Repaint the eight screens from who is standing at them. */
    screens: () => void;
  } | null>(null);
  const [cast, setCast] = useState<SceneBot[]>([]);
  const [ready, setReady] = useState(false);
  const [marks, setMarks] = useState<Map<string, Mark>>(new Map());
  const reduced = useReducedMotion();
  // The first draw loads the office as it stands — nobody walks in on opening.
  const opened = useRef(false);
  const failed = useRef(onUnavailable);
  failed.current = onUnavailable;

  // The room the ticker should be stepping, read without restarting it.
  const shown = useRef(room);
  shown.current = room;
  // …and whether it should be stepping at all. The renderer is built once, before the media
  // query has answered, so the ticker asks this every frame instead of being left out.
  const still = useRef(reduced);
  still.current = reduced;

  // --- the renderer, built once and torn down with the dialog ---------------
  useEffect(() => {
    let dropped = false;
    let app: Application | null = null;
    let watch: ResizeObserver | null = null;
    let minute: number | undefined;
    let onVisible: (() => void) | null = null;
    const cast = actors.current;

    void (async () => {
      const box = canvasBox.current;
      if (!box) return;
      try {
        const lib = await import("pixi.js");
        const made = new lib.Application();
        await made.init({
          width: Math.max(1, box.clientWidth),
          height: Math.max(1, box.clientHeight),
          backgroundAlpha: 0,
          antialias: false,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });
        // Only now is it the cleanup's to tear down: a dialog closed while the renderer
        // was still starting would otherwise leave this one holding a GPU context.
        if (dropped) return tearDown(made);
        app = made;
        // Every layer of the room loads together. A single piece missing throws out of
        // here, and the dialog goes back to its list — the office is never half-drawn.
        const [base, face, asleep] = await Promise.all([
          lib.Assets.load<Texture>(ART.base),
          lib.Assets.load<Texture>(ART.clock),
          lib.Assets.load<Texture>(ART.deskSleep),
        ]);
        const [busy, sheet] = await Promise.all([
          lib.Assets.load<Spritesheet>(ART.deskWork),
          lib.Assets.load<Spritesheet>(ATLAS),
        ]);
        const outlooks = new Map<Period, Texture>(
          await Promise.all(
            PERIODS.map(
              async (p) => [p, await lib.Assets.load<Texture>(SCENERY_ART[p].window)] as const,
            ),
          ),
        );
        // The clouds are the one layer allowed to go missing. A period whose band failed to
        // load keeps its city and a still sky, rather than costing the dialog its office.
        const drifts = new Map<Period, Texture>();
        await Promise.all(
          PERIODS.map(async (p) => {
            try {
              drifts.set(p, await lib.Assets.load<Texture>(SCENERY_ART[p].clouds));
            } catch {
              // Nothing to put back: the period simply keeps a still sky.
            }
          }),
        );
        if (dropped) return;

        const crisp = (t: Texture) => {
          t.source.scaleMode = "nearest";
        };
        for (const t of [base, face, asleep, ...outlooks.values(), ...drifts.values()]) crisp(t);
        for (const frame of Object.values(busy.textures)) crisp(frame);
        for (const frame of Object.values(sheet.textures)) crisp(frame);
        // `clampMargin` belongs to the texture, so every band needs its own — the one the
        // dialog opens on is not the only one it shows. On a context without non-power-of-two
        // wrapping the band falls to the tiling shader, where this keeps the seam off the
        // outermost pixel column.
        for (const t of drifts.values()) t.textureMatrix.clampMargin = -0.5;

        // Back to front: the city seen through the glass, the clouds drifting over it, the
        // room over both with its panes left transparent, the eight desks, the clock and its
        // hands, then the bots. Nothing masks the clouds — the room's panes are transparent,
        // so drawing the band under it is the whole of keeping the sky inside the windows.
        let period = periodAt(new Date());
        const scenery = SCENERY.at.map(() => new lib.Sprite(outlooks.get(period)!));
        const sky = SCENERY.at.map(() => {
          const strip = new lib.TilingSprite({ texture: drifts.get(period) ?? lib.Texture.EMPTY });
          strip.visible = drifts.has(period);
          return strip;
        });
        const floor = new lib.Sprite(base);
        const screens = DESK_AT.map(() => new lib.Sprite(asleep));
        const dial = new lib.Sprite(face);
        const hands = new lib.Container();
        const hourHand = new lib.Graphics().roundRect(-2.4, -16, 4.8, 19, 2).fill(HAND);
        const minuteHand = new lib.Graphics().roundRect(-1.8, -24, 3.6, 27, 1.8).fill(HAND);
        hands.addChild(hourHand, minuteHand, new lib.Graphics().circle(0, 0, 2.6).fill(PIN));
        const layer = new lib.Container();
        app.stage.addChild(...scenery, ...sky, floor, ...screens, dial, hands, layer);
        box.appendChild(app.canvas);
        app.canvas.style.display = "block";

        // Which screens are awake. A desk plays while anyone standing at it is working,
        // and sleeps the moment the last of them stops or turns to leave — shared desks
        // included. The frame is shared: the eight screens show the same four pictures.
        let elapsed = 0;
        // How far the clouds have drifted, in world pixels, wrapped to one tile so the
        // number stays small however long the dialog is left open. Both windows look out on
        // the same sky, so one figure places both bands.
        let drifted = 0;
        const frames = busy.animations.work;
        const paintScreens = () => {
          const frame = still.current
            ? frames[0]
            : frames[Math.floor(elapsed / DESK_FRAME_MS) % frames.length];
          const awake = new Array<boolean>(DESKS).fill(false);
          for (const actor of cast.values()) {
            const bot = actor.bot;
            if (bot.desk === null || bot.room !== shown.current) continue;
            if (!bot.working || actor.leaving || actor.path.length > 0) continue;
            awake[bot.desk] = true;
          }
          screens.forEach((sprite, at) => {
            sprite.texture = awake[at] ? frame : asleep;
          });
        };

        stage.current = {
          sheet,
          layer,
          screens: paintScreens,
          make: () => {
            const sprite = new lib.Sprite(sheet.animations.type[0]);
            sprite.anchor.set(0.5, BOT_GROUND);
            layer.addChild(sprite);
            return sprite;
          },
        };

        const fit = () => {
          const wide = Math.max(1, box.clientWidth);
          const high = Math.max(1, box.clientHeight);
          app?.renderer.resize(wide, high);
          const at = fitCamera(wide, high);
          view.current = at;
          // Every layer is placed in world pixels and drawn at the size the room gives it.
          const put = (sprite: Sprite | TilingSprite, x: number, y: number, w: number, h: number) => {
            sprite.x = at.ox + x * at.scale;
            sprite.y = at.oy + y * at.scale;
            sprite.width = w * at.scale;
            sprite.height = h * at.scale;
          };
          scenery.forEach((sprite, i) => put(sprite, SCENERY.at[i].x, SCENERY.at[i].y, SCENERY.w, SCENERY.h));
          sky.forEach((strip, i) => {
            put(strip, SCENERY.at[i].x, CLOUDS.y, CLOUDS.w, CLOUDS.h);
            // `width`/`height` only say how much wall to cover; the texture itself is sized
            // by `tileScale`, so the camera has to reach both.
            strip.tileScale.set(at.scale);
            strip.tilePosition.set(drifted * at.scale, 0);
          });
          put(floor, 0, 0, WORLD.w, WORLD.h);
          screens.forEach((sprite, i) => put(sprite, DESK_AT[i].x, DESK_AT[i].y, DESK.w, DESK.h));
          put(dial, CLOCK.x, CLOCK.y, CLOCK.w, CLOCK.h);
          hands.x = at.ox + (CLOCK.x + CLOCK.w / 2) * at.scale;
          hands.y = at.oy + (CLOCK.y + CLOCK.h / 2) * at.scale;
          hands.scale.set(at.scale);
          for (const actor of actors.current.values()) draw(actor, at, sheet);
        };
        fit();
        watch = new ResizeObserver(fit);
        watch.observe(box);

        // The clock and the view outside both run off the watching machine's own time, and
        // both are repainted on the minute — not every frame, and not while the tab is
        // hidden. Coming back into view catches them up before anything else is drawn.
        const keepTime = () => {
          window.clearTimeout(minute);
          const now = new Date();
          const turn = handAngles(now);
          hourHand.rotation = turn.hour;
          minuteHand.rotation = turn.minute;
          period = periodAt(now);
          for (const sprite of scenery) sprite.texture = outlooks.get(period)!;
          // The band changes with the hour and the drift carries on from where it was — the
          // sky is the same sky, so nothing jumps as the light turns over.
          const clouds = drifts.get(period);
          for (const strip of sky) {
            strip.visible = clouds !== undefined;
            if (clouds) strip.texture = clouds;
          }
          if (!document.hidden) minute = window.setTimeout(keepTime, untilNextMinute());
        };
        keepTime();
        onVisible = keepTime;
        document.addEventListener("visibilitychange", keepTime);

        paintScreens();
        setReady(true);

        app.ticker.add((ticker) => {
          // A hidden tab pays nothing, and neither does a room nobody is looking at.
          // Reduced motion pays nothing either: every actor is already where it belongs,
          // so holding the frame it is on is the whole of freezing the room — the screens
          // still wake and sleep, repainted by whatever changed the cast.
          if (document.hidden || still.current) return;
          const dt = Math.min(ticker.deltaMS, 120);
          elapsed += dt;
          drifted = (drifted + (SCENERY_ART[period].cloudSpeed * dt) / 1000) % CLOUDS.w;
          for (const strip of sky) strip.tilePosition.x = drifted * view.current.scale;
          let gone = false;
          for (const [id, actor] of cast) {
            if (actor.bot.room !== shown.current) continue;
            if (advance(actor, dt)) {
              actor.sprite?.destroy();
              cast.delete(id);
              gone = true;
              continue;
            }
            draw(actor, view.current, sheet);
          }
          paintScreens();
          // A bot that walked out leaves the cast — a React change, not a frame one.
          if (gone) setCast((was) => was.filter((b) => cast.has(b.id)));
        });
      } catch {
        if (!dropped) failed.current();
      }
    })();

    return () => {
      dropped = true;
      watch?.disconnect();
      window.clearTimeout(minute);
      if (onVisible) document.removeEventListener("visibilitychange", onVisible);
      stage.current = null;
      opened.current = false;
      for (const actor of cast.values()) actor.sprite = undefined;
      cast.clear();
      if (app) tearDown(app);
    };
    // Built once for the life of the dialog: size, cast, room and reduced motion are all
    // read through refs, so nothing here restarts the renderer.
  }, []);

  // --- who is in the room ---------------------------------------------------
  useEffect(() => {
    const built = stage.current;
    if (!ready || !built) return;
    const lib = actors.current;
    const first = !opened.current;
    opened.current = true;

    // Only a bot arriving in the room ON SCREEN walks in. Opening the dialog, polling and
    // paging to another room all load the office as it already stands.
    const walks = (bot: SceneBot) => !first && !reduced && bot.room === room;

    const present = new Set(bots.map((b) => b.id));
    for (const bot of bots) {
      const held = lib.get(bot.id);
      if (held) {
        // A job that came back — resumed, or finished and moved to the sofa — keeps its
        // bot and walks over to wherever it belongs now.
        held.bot = bot;
        held.leaving = false;
        if (held.x === bot.spot.x && held.y === bot.spot.y) continue;
        if (walks(bot)) {
          held.path = [bot.spot];
        } else {
          held.path = [];
          held.x = bot.spot.x;
          held.y = bot.spot.y;
          held.act = bot.working ? "type" : "sit";
        }
        continue;
      }
      const walk = walks(bot) ? walkPath(bot.spot) : [];
      const start = walk[0] ?? bot.spot;
      const actor: Actor = {
        bot,
        x: start.x,
        y: start.y,
        path: walk.slice(1),
        leaving: false,
        act: bot.working ? "type" : "sit",
        frame: Math.floor(Math.random() * 4),
      };
      actor.sprite = built.make();
      lib.set(bot.id, actor);
    }

    for (const [id, actor] of lib) {
      if (present.has(id)) continue;
      // A bot that leaves a room nobody is watching is simply gone by the time they look —
      // and so is one already on its way out when the motion it was walking is switched off.
      if (reduced || actor.bot.room !== room) {
        actor.sprite?.destroy();
        lib.delete(id);
        continue;
      }
      if (actor.leaving) continue;
      actor.leaving = true;
      actor.path = walkPath({ x: actor.x, y: actor.y }).reverse().slice(1);
    }

    for (const actor of lib.values()) {
      if (actor.sprite) actor.sprite.visible = actor.bot.room === room;
      draw(actor, view.current, built.sheet);
    }
    // Arrivals and departures reach the screens on this poll, not the next frame — which is
    // the only way they reach them at all when motion is switched off.
    built.screens();
    setCast([...lib.values()].filter((a) => a.bot.room === room).map((a) => a.bot));
  }, [bots, ready, reduced, room]);

  // The connectors this board can run, for the marks the nameplates wear. One read: a scene
  // that can't get the list falls back to initials rather than waiting on it.
  useEffect(() => {
    let live = true;
    void installedAgentsAction()
      .then((options) => {
        if (live) setMarks(new Map(options.map((o) => [o.name, { label: o.label, icon: o.icon }])));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const hold = useCallback((id: string, node: HTMLButtonElement | null) => {
    const actor = actors.current.get(id);
    if (!actor) return;
    actor.node = node;
    if (node) place(node, actor, view.current);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" onClick={onFloor}>
      <div ref={canvasBox} className="absolute inset-0" aria-hidden />
      {/* The room as something to read: one focus target per bot, in the order the office
          fills, so tabbing through it walks the desks. */}
      <div className="absolute inset-0" role="group" aria-label={c.office}>
        {cast.map((bot) => (
          <BotTarget
            key={bot.id}
            bot={bot}
            mark={marks.get(bot.harness)}
            selected={selected === bot.id}
            hold={hold}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}

// One bot's nameplate and hit target. Position is written by the engine, never by React.
function BotTarget({
  bot,
  mark,
  selected,
  hold,
  onPick,
}: {
  bot: SceneBot;
  mark: Mark | undefined;
  selected: boolean;
  hold: (id: string, node: HTMLButtonElement | null) => void;
  onPick: (bot: SceneBot) => void;
}) {
  const c = useCopy().runs.scene;
  const task = bot.cardId !== null ? `#${bot.cardId}` : bot.label;
  const harness = mark?.label ?? (bot.harness ? spellHarness(bot.harness) : c.noHarness);
  return (
    <button
      type="button"
      id={botTargetId(bot.id)}
      ref={(node) => {
        hold(bot.id, node);
      }}
      title={`${bot.role} · ${task} · ${c.state[bot.status]}`}
      aria-label={c.bot(bot.role, harness, task, c.state[bot.status])}
      onClick={(e) => {
        e.stopPropagation();
        onPick(bot);
      }}
      className={`absolute left-0 top-0 cursor-pointer rounded-[6px] border-0 bg-transparent p-0 outline-offset-2 ${
        selected ? "outline outline-2 outline-nb-accent" : ""
      }`}
    >
      {/* Always legible, never on hover. The two plates sit apart: who is at this desk over
          its head, the card it is on under its feet — between them is the screen it works
          at, and the code on it stays readable. They take no clicks. */}
      <span
        className="pointer-events-none absolute left-1/2 top-full flex -translate-x-1/2 flex-col items-center"
        style={{ width: "var(--nameplate)", marginTop: "calc(-1 * var(--plate-above))" }}
      >
        <span
          className="flex max-w-full items-center gap-[3px] whitespace-nowrap rounded-[3px] bg-nb-paper/95 px-[5px] py-px text-[10.5px] font-[600] leading-[15px]"
          style={{ color: INK }}
        >
          <span className="min-w-0 truncate">{bot.role}</span>
          <HarnessMark icon={mark?.icon} name={harness} />
        </span>
      </span>
      <span
        className="pointer-events-none absolute left-1/2 top-full flex -translate-x-1/2 flex-col items-center"
        style={{ width: "var(--nameplate)", marginTop: "var(--plate-below)" }}
      >
        <span
          className="block max-w-full truncate whitespace-nowrap rounded-[3px] bg-nb-paper/95 px-[4px] text-[9.5px] leading-[14px]"
          style={{ color: INK }}
        >
          {task}
        </span>
      </span>
    </button>
  );
}

/** The connector's mark, in its own brand colours, the way every other screen draws it. A
 *  connector this build ships no mark for wears its initial instead. */
function HarnessMark({ icon, name }: { icon?: string; name: string }) {
  if (!icon) {
    return (
      <span
        aria-hidden
        title={name}
        className="grid size-[11px] shrink-0 place-items-center rounded-[2px] text-[8px] font-[800] leading-none text-nb-paper"
        style={{ background: INK }}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={icon} alt="" title={name} width={11} height={11} className="shrink-0" />
  );
}

// --- the engine --------------------------------------------------------------

/** Give the renderer and its ticker back. The art is NOT destroyed with them: `Assets` keeps
 *  the office and the atlas under their urls, and a second `load` answers with the same
 *  textures — destroying them here would leave the cache holding dead ones and the next open
 *  drawing nothing. */
function tearDown(app: Application) {
  app.destroy({ removeView: true }, { children: true });
}

/** Move one actor along its path and on to the next frame. Answers true when it has just
 *  walked out for good. */
function advance(actor: Actor, dt: number): boolean {
  let left = (WALK * dt) / 1000;
  while (left > 0 && actor.path.length > 0) {
    const to = actor.path[0];
    const dx = to.x - actor.x;
    const dy = to.y - actor.y;
    const gap = Math.hypot(dx, dy);
    if (gap <= left) {
      actor.x = to.x;
      actor.y = to.y;
      actor.path.shift();
      left -= gap;
      continue;
    }
    actor.x += (dx / gap) * left;
    actor.y += (dy / gap) * left;
    if (Math.abs(dx) > 0.5) actor.act = dx < 0 ? "walk-left" : "walk-right";
    left = 0;
  }
  if (actor.path.length === 0) {
    if (actor.leaving) return true;
    actor.act = actor.bot.working ? "type" : "sit";
  }
  // A finished bot holds one seated frame; everyone else cycles.
  actor.frame = actor.act === "sit" ? 0 : (actor.frame + dt / FRAME_MS) % 4;
  return false;
}

function draw(actor: Actor, view: View, sheet: Spritesheet) {
  const sprite = actor.sprite;
  if (sprite) {
    const frames = sheet.animations[actor.act];
    if (frames) sprite.texture = frames[Math.floor(actor.frame) % frames.length];
    sprite.x = view.ox + actor.x * view.scale;
    sprite.y = view.oy + actor.y * view.scale;
    sprite.width = BOT_HEIGHT * view.scale;
    sprite.height = BOT_HEIGHT * view.scale;
  }
  if (actor.node) place(actor.node, actor, view);
}

function place(node: HTMLButtonElement, actor: Actor, view: View) {
  const size = BOT_HEIGHT * view.scale;
  const w = size * BODY;
  const h = size * TALL;
  const cx = view.ox + actor.x * view.scale;
  const ground = view.oy + actor.y * view.scale;
  node.style.width = `${w}px`;
  node.style.height = `${h}px`;
  node.style.transform = `translate(${Math.round(cx - w / 2)}px, ${Math.round(ground - h)}px)`;
  // A nameplate never grows past the gap to the next bot, which is the narrowest the room
  // ever gets: two workers sharing one desk. A longer name truncates and keeps its tooltip.
  node.style.setProperty("--nameplate", `${Math.round(2 * PAIR_OFFSET * view.scale) - 6}px`);
  // Both plates hang off the feet, so they keep their distance from the bot at every size.
  node.style.setProperty("--plate-above", `${PLATE_ABOVE * view.scale}px`);
  node.style.setProperty("--plate-below", `${PLATE_BELOW * view.scale}px`);
}

/** `claude-code` → `Claude code`, for a connector this build ships no mark for. */
function spellHarness(name: string): string {
  const words = name.split("-").join(" ");
  return words ? words[0].toUpperCase() + words.slice(1) : words;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);
  return reduced;
}
