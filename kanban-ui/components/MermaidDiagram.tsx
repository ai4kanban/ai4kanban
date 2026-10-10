"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Render = typeof import("beautiful-mermaid").renderMermaidSVG;

// Loaded on the first diagram only, then kept, so later diagrams draw on the first render.
let loaded: Render | null = null;

const OPTIONS = {
  bg: "var(--color-nb-paper)",
  fg: "var(--color-nb-ink)",
  accent: "var(--color-nb-accent)",
  transparent: true,
  padding: 8,
};

/** The SVG, or null when the source does not draw. Its own stylesheet is scoped to the
 *  diagram, and its web-font import dropped: the page's fonts apply instead. */
function draw(render: Render, code: string): string | null {
  try {
    const svg = render(code, OPTIONS);
    if (!svg.includes('class="node"')) return null;
    return svg
      .replace(/^\s*@import[^\n]*\n/m, "")
      .replace(/^\s*text \{[^}]*\}\n/m, "")
      .replace(/^(\s*)svg \{/m, "$1.nb-mermaid svg {");
  } catch {
    return null;
  }
}

/** A ```mermaid block drawn as a diagram; the block as written while loading or when it
 *  does not draw. */
export function MermaidDiagram({ code, fallback }: { code: string; fallback: ReactNode }) {
  const [render, setRender] = useState<Render | null>(() => loaded);
  useEffect(() => {
    if (render) return;
    let live = true;
    import("beautiful-mermaid")
      .then((m) => {
        loaded = m.renderMermaidSVG;
        if (live) setRender(() => m.renderMermaidSVG);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [render]);
  const svg = useMemo(() => (render ? draw(render, code) : null), [render, code]);
  if (!svg) return <>{fallback}</>;
  return <div className="nb-mermaid" dangerouslySetInnerHTML={{ __html: svg }} />;
}
