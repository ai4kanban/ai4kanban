// WCAG 2.1 contrast, so the design page can print a number instead of leaving
// "is this readable?" to whoever is looking at it. Used only by /design, which
// is a build-time page — nothing here ships in a user-facing bundle.

export type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** What a translucent foreground actually becomes once the ground shows through. */
export function flatten(fg: string, bg: string, alpha: number): string {
  const f = parseHex(fg);
  const b = parseHex(bg);
  const mixed = f.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function relativeLuminance([r, g, b]: Rgb): number {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrast(a: string, b: string): number {
  const la = relativeLuminance(parseHex(a));
  const lb = relativeLuminance(parseHex(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** The bar a pair has to clear, given what it is used for. */
export type TextSize = "body" | "large" | "non-text";

const THRESHOLD: Record<TextSize, number> = {
  // Normal-weight copy, and anything under 18.66px bold / 24px regular.
  body: 4.5,
  // Headings and other large type.
  large: 3,
  // Borders, icons, and other things you only have to see the shape of.
  "non-text": 3,
};

export function verdict(ratio: number, size: TextSize = "body") {
  const min = THRESHOLD[size];
  return {
    min,
    passes: ratio >= min,
    // AAA for body copy is 7:1; worth knowing which pairs clear it.
    aaa: size === "body" && ratio >= 7,
  };
}

export function format(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}
