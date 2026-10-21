"use client";

import { useEffect, useState } from "react";
import { SectionTitle } from "./SectionTitle";
import { Mat } from "./Mat";
import { PauseOffscreen } from "./PauseOffscreen";
import { ShotSessions, type OfficeTime, type Period } from "../shots/ShotSessions";
import type { HomeCopy } from "@/i18n/home/types";

// The running office, alone and centred: the title and one line, then the room
// on its own clock — the reader's — with its loop of traffic.

/** `periodAt` and `handAngles` in kanban-ui/lib/run-scene.ts, in degrees. */
function timeAt(now: Date): OfficeTime {
  const h = now.getHours();
  const m = now.getMinutes();
  const period: Period = h >= 5 && h < 8 ? "dawn" : h >= 8 && h < 17 ? "day" : h >= 17 && h < 20 ? "dusk" : "night";
  return { period, hour: ((h % 12) + m / 60) * 30, minute: m * 6 };
}

export function Office({ c }: { c: HomeCopy["office"] }) {
  // Unknown on the server: the room shows no view and no hands until it is read here.
  const [time, setTime] = useState<OfficeTime | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let tick: number;
    const keep = () => {
      window.clearTimeout(tick);
      setTime(timeAt(new Date()));
      tick = window.setTimeout(keep, 60_000 - (Date.now() % 60_000));
    };
    keep();
    document.addEventListener("visibilitychange", keep);
    return () => {
      window.clearTimeout(tick);
      document.removeEventListener("visibilitychange", keep);
    };
  }, []);

  return (
    <section className="mt-28">
      <SectionTitle title={c.title} />
      <p data-reveal data-delay="1" className="max-w-3xl text-[1.05rem] leading-relaxed text-muted">
        {c.body}
      </p>
      <Mat wash="skyLilac" data-reveal data-delay="2" className="mx-auto mt-10 max-w-3xl p-2 sm:p-3">
        <PauseOffscreen>
          <ShotSessions live={{ time, round, onRound: () => setRound((r) => r + 1) }} />
        </PauseOffscreen>
      </Mat>
    </section>
  );
}
