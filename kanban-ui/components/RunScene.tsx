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
import type { Application, Container, Sprite, Spritesheet, Texture } from "pixi.js";
import { installedAgentsAction } from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import { BOT_GROUND, BOT_HEIGHT, PAIR_OFFSET, WORLD, walkPath, type SceneBot, type Spot } from "@/lib/run-scene";

const OFFICE = "/run-scene/office-eight-desks.png";
const ATLAS = "/run-scene/bot-actions.json";

/** The ink every nameplate is drawn in — never the connector's own brand colour. */
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
  const stage = useRef<{ sheet: Spritesheet; layer: Container; make: () => Sprite } | null>(null);
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
        const office = await lib.Assets.load<Texture>(OFFICE);
        const sheet = await lib.Assets.load<Spritesheet>(ATLAS);
        if (dropped) return;

        office.source.scaleMode = "nearest";
        for (const frame of Object.values(sheet.textures)) frame.source.scaleMode = "nearest";

        const floor = new lib.Sprite(office);
        const layer = new lib.Container();
        app.stage.addChild(floor);
        app.stage.addChild(layer);
        box.appendChild(app.canvas);
        app.canvas.style.display = "block";
        stage.current = {
          sheet,
          layer,
          make: () => {
            const sprite = new lib.Sprite(sheet.animations.type[0]);
            sprite.anchor.set(0.5, BOT_GROUND);
            layer.addChild(sprite);
            return sprite;
          },
        };

        const fit = () => {
          const w = Math.max(1, box.clientWidth);
          const h = Math.max(1, box.clientHeight);
          app?.renderer.resize(w, h);
          // Cover: the room fills the dialog's interior, and the crop falls outside the desks.
          const scale = Math.max(w / WORLD.w, h / WORLD.h);
          view.current = { scale, ox: (w - WORLD.w * scale) / 2, oy: (h - WORLD.h * scale) / 2 };
          floor.x = view.current.ox;
          floor.y = view.current.oy;
          floor.width = WORLD.w * scale;
          floor.height = WORLD.h * scale;
          for (const actor of actors.current.values()) draw(actor, view.current, sheet);
        };
        fit();
        watch = new ResizeObserver(fit);
        watch.observe(box);
        setReady(true);

        app.ticker.add((ticker) => {
          // A hidden tab pays nothing, and neither does a room nobody is looking at.
          // Reduced motion pays nothing either: every actor is already where it belongs,
          // so holding the frame it is on is the whole of freezing the room.
          if (document.hidden || still.current) return;
          const dt = Math.min(ticker.deltaMS, 120);
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
      {/* Always legible, never on hover: who is at this desk and what they run on. It sits
          outside the target's own box, and takes no clicks of its own. */}
      <span
        className="pointer-events-none absolute bottom-full left-1/2 mb-[3px] flex -translate-x-1/2 items-center gap-[3px] whitespace-nowrap rounded-[3px] bg-nb-paper/95 px-[5px] py-px text-[10.5px] font-[600] leading-[15px]"
        style={{ color: INK, maxWidth: "var(--nameplate)" }}
      >
        <span className="min-w-0 truncate">{bot.role}</span>
        <HarnessMark icon={mark?.icon} name={harness} />
      </span>
      <span
        className="pointer-events-none absolute left-1/2 top-full mt-px block -translate-x-1/2 truncate whitespace-nowrap rounded-[3px] bg-nb-paper/95 px-[4px] text-[9.5px] leading-[14px]"
        style={{ color: INK, maxWidth: "var(--nameplate)" }}
      >
        {task}
      </span>
    </button>
  );
}

/** The connector's mark, in ink rather than its own colour — masked, so one file serves
 *  both. A connector this build ships no mark for wears its initial instead. */
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
    <span
      aria-hidden
      title={name}
      className="size-[11px] shrink-0"
      style={{
        background: INK,
        maskImage: `url(${icon})`,
        WebkitMaskImage: `url(${icon})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
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
