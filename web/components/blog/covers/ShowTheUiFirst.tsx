// "Show me before you build": the headline on the left; on the right a fading
// plan.md marked wrong above a visual spec marked right. Drawn on an 1800×1000
// canvas; the viewBox widens it to 16:10. Motion is the trend line drawing in
// once, behind `prefers-reduced-motion: no-preference`; with motion off the line is whole.

const MOTION = `
@keyframes cvr-ui-first-line { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
@media (prefers-reduced-motion: no-preference) {
  .cvr-ui-first-line { stroke-dasharray: 1; animation: cvr-ui-first-line 1.6s ease-out 0.3s both }
}
`;

export function ShowTheUiFirst({ alt }: { alt: string }) {
  return (
    <svg viewBox="18 -60 1760 1100" className="block h-full w-full" role="img" aria-label={alt}>
      <style>{MOTION}</style>
      <defs>
        <linearGradient id="cvr-ui-first-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" />
          <stop offset="1" stopColor="black" />
        </linearGradient>
        <mask id="cvr-ui-first-plan" maskUnits="userSpaceOnUse" x="960" y="160" width="760" height="200">
          <path fill="white" d="M960 160h760v125H960z" />
          <path fill="url(#cvr-ui-first-fade)" d="M960 285h760v75H960z" />
        </mask>
      </defs>
      <path fill="#faf7f2" d="M18 -60h1760v1100H18z" />
      <g fill="#382f42" fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif">
        <g fontFamily="Georgia, Times New Roman, serif" fontSize="200" letterSpacing="-8">
          <text x="72" y="375">Show me</text>
          <text x="72" y="575">before</text>
          <text x="72" y="775">you build.</text>
        </g>
        <text x="960" y="130" fontSize="35" fontWeight="600">plan.md</text>
        <path d="m1683 99 31 31m0-31-31 31" stroke="#b95536" strokeWidth="7" strokeLinecap="round" />
        <path fill="#f5cfbb" d="M960 160h760v200H960z" />
        <g fontSize="33" fill="#654b41" mask="url(#cvr-ui-first-plan)">
          <text x="1000" y="222">Add a page that shows how many users</text>
          <text x="1000" y="272">ran at least one task each day. Place</text>
          <text x="1000" y="322">today’s total above a line chart, then</text>
        </g>
        <text x="960" y="470" fontSize="35" fontWeight="600">visual spec</text>
        <path d="m1666 453 15 15 32-35" fill="none" stroke="#66507f" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path fill="#e5daf2" d="M960 500h760v420H960z" />
        <text x="1000" y="568" fontSize="43" fontWeight="600" letterSpacing="-1">Daily active users</text>
        <text x="996" y="742" fontSize="176" fontWeight="500" letterSpacing="-5">112</text>
        <path
          className="cvr-ui-first-line"
          pathLength={1}
          d="M1000 878 1056 873 1112 880 1168 858 1224 863 1280 854 1336 860 1392 843 1448 849 1504 836 1560 842 1616 827 1680 818"
          fill="none"
          stroke="#82609f"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
