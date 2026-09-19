"use client";

import { useEffect, useRef, useState } from "react";
import type { HyperframesPlayer as Player } from "@hyperframes/player";
import { FiPause, FiPlay, FiRotateCcw, FiVolume2, FiVolumeX } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { clock } from "./MediaPlayer";

let activePlayer: Player | null = null;

export function HyperframePlayer({ doc, title }: { doc: string; title: string }) {
  const c = useCopy().card.mockup;
  const root = useRef<HTMLSpanElement>(null);
  const host = useRef<HTMLSpanElement>(null);
  const player = useRef<Player | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shown, setShown] = useState(false);

  // A tap outside hides controls a tap showed; a mouse leaving hides them on its own.
  useEffect(() => {
    if (!shown) return;
    const away = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && !root.current?.contains(event.target as Node)) setShown(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [shown]);

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

  const button = "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white hover:bg-white/15 disabled:cursor-default disabled:opacity-40 pointer-coarse:size-11";
  const bar = duration ? Math.min(position / duration, 1) * 100 : 0;
  return (
    <span
      ref={root}
      className="group relative block overflow-hidden"
      data-shown={shown || undefined}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setShown(true); }}
      onPointerLeave={(event) => { if (event.pointerType === "mouse") setShown(false); }}
    >
      <span ref={host} className="block aspect-video w-full bg-[#f8f5ef]" />
      {/* Taps land on the iframe otherwise, and never reach this frame. */}
      <span aria-hidden className="absolute inset-0" onPointerUp={(event) => {
        if (event.pointerType !== "mouse") setShown((v) => !v);
      }} />
      {failed ? (
        <span role="alert" className="absolute inset-0 flex items-center justify-center bg-[#f8f5ef] p-4 text-center text-sm text-nb-ink-soft">
          {c.previewFailed}
        </span>
      ) : !ready ? (
        <span role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-nb-ink-soft">
          {c.loadingPreview}
        </span>
      ) : null}
      {!failed && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 block bg-linear-to-b from-transparent via-black/70 to-black/85 px-3 pt-6 pb-1.5 text-white opacity-0 transition-opacity duration-200 group-data-shown:pointer-events-auto group-data-shown:opacity-100 has-focus-visible:pointer-events-auto has-focus-visible:opacity-100">
          <input type="range" aria-label={c.seek} min={0} max={duration || 1} step={0.01}
            value={Math.min(position, duration)} disabled={!ready}
            className="block h-5 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,white_var(--bar),#ffffff59_var(--bar))] [&::-webkit-slider-thumb]:mt-[-3.5px] [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-track]:h-[3px] [&::-moz-range-track]:bg-white/35 [&::-moz-range-progress]:h-[3px] [&::-moz-range-progress]:bg-white [&::-moz-range-thumb]:size-2.5 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
            style={{ ["--bar" as string]: `${bar}%` }}
            onChange={(event) => {
              const time = Number(event.target.value);
              player.current?.pause();
              player.current?.seek(time);
              setPosition(time);
              setPaused(true);
            }} />
          <span className="flex items-center gap-1">
            <button type="button" disabled={!ready} className={button} aria-label={paused ? c.play : c.pause}
              title={paused ? c.play : c.pause} onClick={() => {
                if (player.current?.paused) player.current.play();
                else player.current?.pause();
              }}>
              {paused ? <FiPlay aria-hidden fill="currentColor" /> : <FiPause aria-hidden fill="currentColor" />}
            </button>
            <span className="whitespace-nowrap text-xs tabular-nums">
              {clock(position)} <span className="text-white/70">/ {clock(duration)}</span>
            </span>
            <span className="flex-1" />
            <button type="button" disabled={!ready} className={button} aria-label={c.replay} title={c.replay} onClick={() => {
              player.current?.seek(0);
              player.current?.play();
            }}><FiRotateCcw aria-hidden /></button>
            <button type="button" disabled={!ready} className={button} aria-label={muted ? c.unmute : c.mute}
              title={muted ? c.unmute : c.mute} onClick={() => {
                if (player.current) player.current.muted = !muted;
                setMuted(!muted);
              }}>{muted ? <FiVolumeX aria-hidden /> : <FiVolume2 aria-hidden />}</button>
          </span>
        </span>
      )}
    </span>
  );
}
