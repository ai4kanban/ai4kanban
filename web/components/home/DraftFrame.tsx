"use client";

import { useEffect, useRef, useState } from "react";

// A workflow preview's frame. Each one is a page of the board app, and six of them loading with
// the home page held up its first paint, so they wait for the reader's first scroll, or for the
// section to come near, and then load one at a time: the next starts once the last has drawn
// (`draft-ready` from /demo/drafts) and the page is idle. A placeholder stands in until then.
let queue = Promise.resolve();
const idle = (run: () => void) =>
  "requestIdleCallback" in window ? requestIdleCallback(run, { timeout: 1000 }) : setTimeout(run, 200);

export function DraftFrame({ src, title, className }: { src: string; title: string; className: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [load, setLoad] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let gone = false;
    let started = false;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || e.data !== "draft-ready") return;
      removeEventListener("message", onMessage);
      setReady(true);
      advance();
    };
    let advance = () => {};
    const start = () => {
      if (started) return;
      started = true;
      io.disconnect();
      removeEventListener("scroll", start);
      queue = queue.then(
        () =>
          new Promise<void>((done) => {
            if (gone) return done();
            idle(() => {
              advance = done;
              addEventListener("message", onMessage);
              setTimeout(done, 3000);
              setLoad(true);
            });
          }),
      );
    };
    const io = new IntersectionObserver((seen) => seen.some((e) => e.isIntersecting) && start(), {
      rootMargin: "100% 0px",
    });
    io.observe(frame);
    addEventListener("scroll", start, { once: true, passive: true });
    return () => {
      gone = true;
      io.disconnect();
      removeEventListener("message", onMessage);
      removeEventListener("scroll", start);
    };
  }, []);
  return (
    <span className={`wf-frame relative ${className}`}>
      {!ready && (
        <span aria-hidden className="absolute inset-0 flex flex-col gap-[6%] p-[4%] motion-safe:animate-pulse">
          <span className="block h-[5%] w-2/5 rounded bg-ink/10" />
          <span className="block flex-1 rounded-md bg-ink/[0.06]" />
        </span>
      )}
      <iframe
        ref={ref}
        src={load ? src : undefined}
        title={title}
        tabIndex={-1}
        aria-hidden
        className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${ready ? "" : "opacity-0"}`}
      />
    </span>
  );
}
