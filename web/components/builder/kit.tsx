import type { ReactNode } from "react";

export const INK = "#24231f";
export const MUTED = "#635a4e";
export const ACCENT = "#dd4f1e";

const line = {
  fill: "none",
  stroke: INK,
  strokeWidth: 3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// Wobbles every stroke so the drawing reads as a pencil sketch.
export function Sketch({ id, children }: { id: string; children: ReactNode }) {
  return (
    <>
      <defs>
        <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="3" />
        </filter>
      </defs>
      <g filter={`url(#${id})`}>{children}</g>
    </>
  );
}

// A chibi anime kid; `arm` sets which way it reaches.
export function Kid({
  x,
  y,
  arm = "down",
  mood = "calm",
}: {
  x: number;
  y: number;
  arm?: "down" | "point" | "up" | "left";
  mood?: "calm" | "tired" | "happy";
}) {
  const rightArm =
    arm === "point" ? "M18 52 Q40 58 60 50" : arm === "left" ? "M18 52 Q26 76 26 92" : arm === "up" ? "M18 52 Q34 32 40 14" : "M18 52 Q26 76 26 92";
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* body */}
      <path {...line} fill="#fff" d="M-6 40 L-24 112 Q0 120 24 112 L6 40 Z" />
      <path {...line} d="M-10 112 L-12 150 M10 112 L12 150" />
      <path {...line} d={arm === "left" ? "M-18 52 Q-40 58 -60 50" : "M-18 52 Q-28 76 -26 92"} />
      <path {...line} d={rightArm} />
      {/* head */}
      <path {...line} fill="#fff" d="M-36 2 Q-38 -40 0 -42 Q38 -40 36 2 Q34 38 0 40 Q-34 38 -36 2 Z" />
      {/* hair */}
      <path
        {...line}
        fill={INK}
        d="M-38 4 Q-46 -46 -6 -50 Q30 -54 40 -20 Q42 -6 38 6 L30 -14 L22 -2 L14 -20 L2 -6 L-8 -22 L-18 -4 L-26 -18 Z"
      />
      {/* eyes */}
      {mood === "happy" ? (
        <path {...line} strokeWidth={3.5} d="M-20 10 Q-14 2 -8 10 M8 10 Q14 2 20 10" />
      ) : (
        <>
          <ellipse cx={-14} cy={mood === "tired" ? 12 : 10} rx={6} ry={mood === "tired" ? 5 : 9} fill={INK} />
          <ellipse cx={14} cy={mood === "tired" ? 12 : 10} rx={6} ry={mood === "tired" ? 5 : 9} fill={INK} />
          <circle cx={-12} cy={6} r={2.2} fill="#fff" />
          <circle cx={16} cy={6} r={2.2} fill="#fff" />
          {mood === "tired" && <path {...line} strokeWidth={2} d="M-22 4 L-6 6 M6 6 L22 4" />}
        </>
      )}
      <path stroke={ACCENT} strokeWidth={2} strokeLinecap="round" d="M-28 22 L-24 20 M-24 24 L-20 22 M20 22 L24 20 M24 24 L28 22" />
      <path {...line} strokeWidth={2.5} d={mood === "tired" ? "M-4 28 Q0 26 4 28" : "M-5 26 Q0 31 5 26"} />
    </g>
  );
}

// The agent: a small round robot.
export function Bot({ x, y, children }: { x: number; y: number; children?: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path {...line} d="M0 -38 L0 -52" />
      <circle cx={0} cy={-56} r={5} fill={ACCENT} stroke={INK} strokeWidth={2.5} />
      <rect {...line} fill="#fff" x={-32} y={-38} width={64} height={50} rx={18} />
      <circle cx={-12} cy={-14} r={5} fill={INK} />
      <circle cx={12} cy={-14} r={5} fill={INK} />
      <path {...line} strokeWidth={2.5} d="M-6 0 Q0 4 6 0" />
      <rect {...line} fill="#fff" x={-22} y={16} width={44} height={40} rx={10} />
      <path {...line} d="M-12 56 L-14 76 M12 56 L14 76" />
      {children}
    </g>
  );
}

export function Figure({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <figure className="bg-white">
      {children}
      <figcaption className="mt-2 text-center text-[0.95rem] italic text-muted">{caption}</figcaption>
    </figure>
  );
}
