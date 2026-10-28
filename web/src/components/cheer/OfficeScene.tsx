import type { CSSProperties } from "react";
import { confetti } from "./confetti";
import "./cheer.css";

// Copied from legacy kanban-ui/components/cheer/OfficeScene.tsx with the lib/run-scene.ts
// constants it reads.
const LAYERS = "/run-scene/layers";
const ART = { base: `${LAYERS}/office-base.png` };
const SCENERY = { at: [{ x: 264 }, { x: 879 }] };
type Period = "dawn" | "day" | "dusk" | "night";
const SCENERY_ART: Record<Period, { window: string }> = {
  dawn: { window: `${LAYERS}/window-dawn.png` },
  day: { window: `${LAYERS}/window-day.png` },
  dusk: { window: `${LAYERS}/window-dusk.png` },
  night: { window: `${LAYERS}/window-night.png` },
};
function periodAt(now: Date): Period {
  const hour = now.getHours();
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

export const BOT_CHEER = "/run-scene/bot-cheer.png";

/** Everything the scene draws, so a caller can hold it back until the art is in. */
export const cheerArt = (now: Date): string[] => [ART.base, SCENERY_ART[periodAt(now)].window, BOT_CHEER];

// [left, top, scale, stagger] in world pixels. The larger centre robot is drawn last.
const BOTS = [
  [660.2, 170, 0.9, 0],
  [870.2, 170, 0.9, 2],
  [736.96, 145.4, 1.17, 1],
] as const;

/** The corner office (#1331): the Runs room cropped to the floor by the bookshelf, three
 *  robots cheering and their confetti. Plain DOM and CSS — no Pixi. */
export function OfficeScene({ now }: { now: Date }) {
  const view = SCENERY_ART[periodAt(now)].window;
  return (
    <div className="cheer-office" aria-hidden="true">
      <div className="cheer-world">
        {SCENERY.at.map(({ x }) => (
          <img key={x} src={view} className="cheer-window" style={{ left: x }} alt="" />
        ))}
        <img src={ART.base} className="cheer-room" alt="" />
        {BOTS.map(([left, top, scale, index]) => (
          <div key={index}>
            <div
              className="cheer-shadow"
              style={{ left: left + 88 * scale, top: top + 177 * scale, width: 48 * scale, height: 10 * scale }}
            />
            <div className="cheer-bot-position" style={{ left, top, transform: `scale(${scale})` }}>
              <div className={`cheer-bot cheer-bot-${index}`} style={{ backgroundImage: `url(${BOT_CHEER})` }} />
            </div>
          </div>
        ))}
        {confetti.map(({ x, y, size, color, ribbon }, index) => (
          <i
            key={index}
            className={`cheer-confetti${ribbon ? " cheer-streamer" : ""}`}
            style={
              {
                left: x,
                top: y,
                width: ribbon ? size * 1.5 : size,
                height: ribbon ? size * 4 : size,
                background: color,
                "--paper-motion": `cheer-paper-${index}`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
