import type { ReactNode } from "react";
import { CROP, HAIR, MONO, NB, Shot, em } from "./nb";

// Step 06 仅在必要时请求审批 — the card notification as it arrives in Slack, from
// screenshots/slack-notification.png: the card, the state it reached, what it
// asks for, and the two buttons that answer it from the phone in your hand.
//
// The real message is ~1030px wide and this frame is two thirds of that, so the
// card's text is cut to what still fits at the same type size — the message is
// cloned, not scaled.

/** Slack's own button — the green primary and the outlined default. */
function SlackButton({ primary, children }: { primary?: boolean; children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: em(32),
        padding: `${em(7)} ${em(14)}`,
        border: primary ? "none" : `1px solid color-mix(in srgb, ${NB.ink} 28%, transparent)`,
        borderRadius: em(5),
        background: primary ? "#007a5a" : NB.paper,
        color: primary ? NB.paper : NB.ink,
        fontSize: em(13),
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

// The app's avatar, at the two sizes Slack draws one: sender and thread reply.
// The official mark itself, double offset and all, rather than a copy of its
// geometry — a redrawn mark is one more place a logo change has to reach.
function Avatar({ size }: { size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/favicon.svg"
      alt=""
      aria-hidden
      style={{ width: em(size), height: em(size), flex: "0 0 auto" }}
    />
  );
}

/** Slack's inline code — mono on a hairline chip, in its own red. */
function SlackCode({ children }: { children: ReactNode }) {
  return (
    <code
      style={{
        fontFamily: MONO,
        fontSize: "0.9em",
        color: "#c0325c",
        background: NB.cream,
        border: `1px solid color-mix(in srgb, ${NB.ink} 14%, transparent)`,
        borderRadius: em(4, 12.5),
        padding: `${em(1, 12.5)} ${em(4, 12.5)}`,
      }}
    >
      {children}
    </code>
  );
}

const BULLET = {
  margin: `${em(6)} 0 0`,
  fontSize: em(12.5),
  lineHeight: 1.55,
} as const;

export function ShotApprovalEvent() {
  return (
    <Shot crop={CROP}>
      <div style={{ padding: em(20) }}>
        {/* sender line */}
        <div style={{ display: "flex", alignItems: "center", gap: em(9), marginBottom: em(8) }}>
          <Avatar size={32} />
          <strong style={{ fontSize: em(15) }}>AI4Kanban</strong>
          <span
            style={{
              padding: `${em(2)} ${em(5)}`,
              borderRadius: em(4),
              background: NB.wash,
              color: NB.inkSoft,
              fontSize: em(10),
              fontWeight: 800,
            }}
          >
            APP
          </span>
          <span style={{ color: NB.inkSoft, fontSize: em(12) }}>11:44 AM</span>
        </div>

        {/* the card, then where it stands */}
        <h2 style={{ margin: 0, fontSize: em(15), fontWeight: 800, lineHeight: 1.35 }}>
          #357 Lay the board out for a phone screen
        </h2>
        <p style={{ margin: `${em(6)} 0 ${em(12)}`, color: NB.inkSoft, fontSize: em(12.5) }}>
          👀 <strong style={{ color: NB.ink }}>Ready for review</strong> · ai4kanban ·
          release 0.9.0
        </p>

        <p style={{ margin: 0, fontSize: em(13), lineHeight: 1.6 }}>
          The board is drawn for a window. On a phone it renders at desktop width
          and is scaled down, so text is unreadable and the rail that carries{" "}
          <strong>Find a card</strong> and <strong>Memory</strong> is hidden outright.
        </p>

        <p style={{ margin: `${em(12)} 0 0`, fontSize: em(13.5), fontWeight: 800 }}>
          Worth noting
        </p>
        <p style={BULLET}>
          • <strong>The phone gets a navigation shell the window has no counterpart
          for</strong>: a bottom tab bar of Board, Find, Memory and More puts every
          way into the board one tap away.
        </p>
        <p style={BULLET}>
          • <strong>One app, not two</strong>: the same pages get a phone layout,
          rather than <SlackCode>kanban-ui/</SlackCode> forking into a second front
          end.
        </p>

        {/* the answer, and where the answer runs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: em(8),
            marginTop: em(14),
            paddingTop: em(12),
            borderTop: `1px solid ${HAIR}`,
          }}
        >
          <SlackButton primary>Implement</SlackButton>
          <SlackButton>Open card in app</SlackButton>
        </div>
        <p style={{ margin: `${em(10)} 0 0`, color: NB.inkSoft, fontSize: em(11.5) }}>
          Runs on wutaos-MacBook-Pro when it is reachable.
        </p>

        {/* the thread the answer is logged in */}
        <div style={{ display: "flex", alignItems: "center", gap: em(8), marginTop: em(10) }}>
          <Avatar size={18} />
          <span style={{ color: "#1264a3", fontSize: em(12.5), fontWeight: 700 }}>
            1 reply
          </span>
          <span style={{ color: NB.inkSoft, fontSize: em(12) }}>1 day ago</span>
        </div>
      </div>
    </Shot>
  );
}
