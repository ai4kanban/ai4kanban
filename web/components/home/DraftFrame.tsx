"use client";

import { useEffect, useRef, useState } from "react";

// A workflow preview's frame. Each one is a page of the board app, and six of them loading with
// the home page held up its first paint, so they wait for the reader's first scroll and then load
// one at a time, each when the page is idle, so no two start up in the same frame.
let queue = Promise.resolve();
const idle = (run: () => void) =>
  "requestIdleCallback" in window ? requestIdleCallback(run, { timeout: 1000 }) : setTimeout(run, 200);

export function DraftFrame({ src, title, className }: { src: string; title: string; className: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [load, setLoad] = useState(false);
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let gone = false;
    const start = () => {
      queue = queue.then(
        () =>
          new Promise<void>((done) => {
            if (gone) return done();
            idle(() => {
              frame.addEventListener("load", () => done(), { once: true });
              setTimeout(done, 3000);
              setLoad(true);
            });
          }),
      );
    };
    addEventListener("scroll", start, { once: true, passive: true });
    return () => {
      gone = true;
      removeEventListener("scroll", start);
    };
  }, []);
  return <iframe ref={ref} src={load ? src : undefined} title={title} tabIndex={-1} aria-hidden className={className} />;
}
