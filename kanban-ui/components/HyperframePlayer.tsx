"use client";

import { useEffect, useRef, useState } from "react";
import type { HyperframesPlayer as Player } from "@hyperframes/player";
import { FiPause, FiPlay, FiRotateCcw, FiVolume2, FiVolumeX } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { clock } from "./MediaPlayer";

let activePlayer: Player | null = null;

export function HyperframePlayer({ doc, title }: { doc: string; title: string }) {
  const c = useCopy().card.mockup;
  const host = useRef<HTMLSpanElement>(null);
  const player = useRef<Player | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let current: Player | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    setReady(false);
    setFailed(false);
    setPaused(true);
    setPosition(0);
    setDuration(0);
    setMuted(false);

    void import("@hyperframes/player").then(() => {
      if (cancelled || !host.current) return;
      const el = document.createElement("hyperframes-player") as Player;
      current = el;
      player.current = el;
      el.setAttribute("sandbox-origin", "");
      el.setAttribute("srcdoc", doc);
      el.setAttribute("aria-label", title);
      el.style.cssText = "display:block;width:100%;aspect-ratio:16/9;background:#f8f5ef";
      el.muted = false;
      el.addEventListener("ready", () => {
        clearTimeout(timeout);
        setDuration(el.duration);
        setReady(true);
      });
      el.addEventListener("play", () => {
        if (activePlayer !== el) activePlayer?.pause();
        activePlayer = el;
        setPaused(false);
      });
      el.addEventListener("pause", () => setPaused(true));
      el.addEventListener("ended", () => setPaused(true));
      el.addEventListener("timeupdate", () => setPosition(el.currentTime));
      el.addEventListener("error", () => {
        clearTimeout(timeout);
        el.pause();
        setFailed(true);
      });
      timeout = setTimeout(() => {
        el.pause();
        setFailed(true);
      }, 20000);
      host.current.replaceChildren(el);
    }).catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      current?.pause();
      current?.remove();
      if (activePlayer === current) activePlayer = null;
      player.current = null;
    };
  }, [doc, title]);

  const button = "inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-sm hover:bg-nb-wash disabled:opacity-40 cursor-pointer";
  return (
    <span className="block">
      <span ref={host} className="block w-full" />
      {failed ? <span role="alert" className="block py-2 text-sm">{c.previewFailed}</span> : (
        <span className="flex flex-wrap items-center gap-2 py-2">
          <button type="button" disabled={!ready} className={button} onClick={() => {
            if (player.current?.paused) player.current.play();
            else player.current?.pause();
          }}>
            {paused ? <FiPlay aria-hidden /> : <FiPause aria-hidden />}
            {paused ? c.play : c.pause}
          </button>
          <button type="button" disabled={!ready} className={button} onClick={() => {
            player.current?.seek(0);
            player.current?.play();
          }} aria-label={c.replay} title={c.replay}><FiRotateCcw aria-hidden /></button>
          <input type="range" aria-label={c.seek} min={0} max={duration || 1} step={0.01}
            value={Math.min(position, duration)} disabled={!ready} className="min-w-16 flex-1 accent-nb-accent"
            onChange={(event) => {
              const time = Number(event.target.value);
              player.current?.seek(time);
              setPosition(time);
              setPaused(true);
            }} />
          <span className="text-xs tabular-nums">{ready ? `${clock(position)} / ${clock(duration)}` : c.loadingPreview}</span>
          <button type="button" disabled={!ready} className={button} aria-label={muted ? c.unmute : c.mute}
            title={muted ? c.unmute : c.mute} onClick={() => {
              if (player.current) player.current.muted = !muted;
              setMuted(!muted);
            }}>{muted ? <FiVolumeX aria-hidden /> : <FiVolume2 aria-hidden />}</button>
        </span>
      )}
    </span>
  );
}
