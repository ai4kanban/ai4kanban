import type { ReactNode } from "react";
import {
  FiChevronRight,
  FiColumns,
  FiFileText,
  FiMoreHorizontal,
  FiScissors,
  FiSearch,
} from "react-icons/fi";
import { HAIR, MONO, NB, Shot, em } from "./nb";

// The board's memory page, drawn (#812). Mirrors kanban-ui's `Rail.tsx`
// (`MemoryPanel`, `OwnerRows`, `RailRow`) and `MemoryPage.tsx`: the rail's
// Memory panel on the left, one memory file open on the right.
//
// It stands in for a screenshot on the agent pages, so it has to stay true to
// the board — a change to the memory panel or the memory page makes this
// quietly wrong, and this file is where it is put back.
//
// What the picture has to carry: memory belongs to a WHOSE, not to a where. The
// panel groups files by owner — the board's own record, then each agent that
// remembers — and a module is a `## <module>` heading inside a file, which is
// why the open file shows two of them.
//
// The content is written here and comes off no real board.

/** The window this is a drawing of, in board pixels. Everything is `em` off a
 *  root that is this share of the container, so the whole drawing scales with
 *  the column it lands in and the line breaks never move. */
const RAIL = 200;
const BODY = 412;
const W = RAIL + BODY;

const ROW = 30;

function Row({
  label,
  id,
  icon,
  active,
  indent,
}: {
  label: string;
  id?: number;
  icon?: ReactNode;
  active?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: em(8),
        height: em(ROW),
        marginLeft: indent ? em(14) : undefined,
        padding: `0 ${em(8)} 0 ${em(10)}`,
        borderRadius: em(8),
        fontSize: em(12.5),
        fontWeight: active ? 700 : 600,
        whiteSpace: "nowrap",
        color: active ? NB.ink : NB.inkSoft,
        background: active ? NB.paper : undefined,
        boxShadow: active ? `inset 0 0 0 ${em(1.5)} ${NB.ink}` : undefined,
      }}
    >
      {id === undefined ? (
        <span
          aria-hidden
          style={{
            display: "flex",
            width: em(13),
            height: em(13),
            flex: "0 0 auto",
          }}
        >
          {icon}
        </span>
      ) : (
        <span
          style={{
            flex: "0 0 auto",
            fontFamily: MONO,
            fontSize: em(11),
            opacity: 0.6,
          }}
        >
          {id}
        </span>
      )}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
    </div>
  );
}

/** An owner's fold: the board itself, or one agent. Open, its files sit under
 *  it; closed, it is the one line an agent that has remembered nothing gets. */
function Owner({ name, open, children }: { name: string; open?: boolean; children?: ReactNode }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: em(8),
          height: em(ROW),
          padding: `0 ${em(10)}`,
          fontSize: em(12.5),
          fontWeight: 600,
          whiteSpace: "nowrap",
          color: NB.inkSoft,
        }}
      >
        <FiChevronRight
          aria-hidden
          style={{
            width: em(13),
            height: em(13),
            flex: "0 0 auto",
            transform: open ? "rotate(90deg)" : undefined,
          }}
        />
        {name}
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: em(2), paddingTop: em(2) }}>
          {children}
        </div>
      )}
    </div>
  );
}

function File({ label, active }: { label: string; active?: boolean }) {
  return (
    <Row
      label={label}
      active={active}
      indent
      icon={<FiFileText style={{ width: "100%", height: "100%" }} />}
    />
  );
}

function Rail() {
  return (
    <div
      style={{
        width: em(RAIL),
        flex: "0 0 auto",
        display: "flex",
        flexDirection: "column",
        padding: `${em(8)} ${em(6)}`,
        background: NB.cream,
      }}
    >
      {/* Find a card, then the cards — the memory panel sits at the FOOT of the
          rail, and drawn without them it would read as the whole rail. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: em(8),
          height: em(ROW),
          padding: `0 ${em(10)}`,
          borderRadius: em(8),
          background: NB.paper,
          boxShadow: `inset 0 0 0 ${em(1)} color-mix(in srgb, #24231f 18%, transparent)`,
          fontSize: em(12.5),
          fontWeight: 600,
          whiteSpace: "nowrap",
          color: "color-mix(in srgb, #565550 70%, transparent)",
        }}
      >
        <FiSearch aria-hidden style={{ width: em(13), height: em(13), flex: "0 0 auto" }} />
        Find a card
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: em(2), marginTop: em(6) }}>
        <Row label="All cards" icon={<FiColumns style={{ width: "100%", height: "100%" }} />} />
        <Row label="Let a run pick its own model" id={128} />
        <Row label="Prices in the buyer's currency" id={134} />
      </div>

      <div style={{ marginTop: em(10), borderTop: `${em(1)} solid ${HAIR}` }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${em(10)} ${em(10)} ${em(6)}`,
            color: NB.inkSoft,
          }}
        >
          <span
            style={{
              fontSize: em(10),
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            Memory
          </span>
          <FiChevronRight
            aria-hidden
            style={{ width: em(13), height: em(13), transform: "rotate(90deg)" }}
          />
        </div>

        {/* The one thing you DO to the memory, over the files you read. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: em(6),
            height: em(32),
            margin: `0 ${em(10)} ${em(8)}`,
            borderRadius: em(9),
            border: `${em(1.5)} solid ${NB.ink}`,
            boxShadow: `${em(2)} ${em(2)} 0 0 ${NB.ink}`,
            background: NB.paper,
            fontSize: em(12),
            fontWeight: 700,
            whiteSpace: "nowrap",
            color: NB.accentDeep,
          }}
        >
          <FiScissors aria-hidden style={{ width: em(12), height: em(12) }} />
          Prune memory
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: em(2) }}>
          <Owner name="Board" open>
            <File label="What shipped" />
            <File label="The goal" />
          </Owner>
          <Owner name="Planner" open>
            <File label="Settled decisions" active />
            <File label="Design mistakes" />
            <File label="Rejected ideas" />
          </Owner>
          {/* A specialist that keeps memory of its own — folded, because it has
              one line to show. No MODULES group: modules are not owners. */}
          <Owner name="ui-designer" />
        </div>
      </div>
    </div>
  );
}

/** A `## <module>` topic and the decisions filed under it. */
function Topic({ name, notes }: { name: string; notes: [string, string][] }) {
  return (
    <>
      <div
        style={{
          marginTop: em(20),
          fontSize: em(17),
          fontWeight: 800,
          lineHeight: 1.22,
          letterSpacing: "-0.018em",
        }}
      >
        {name}
      </div>
      <ul
        style={{
          margin: `${em(10)} 0 0`,
          paddingLeft: em(18),
          listStyle: "disc",
          fontSize: em(13),
          lineHeight: 1.6,
          color: NB.ink,
        }}
      >
        {notes.map(([key, note]) => (
          <li key={key} style={{ paddingLeft: em(4, 13), marginTop: em(6, 13) }}>
            <strong style={{ fontWeight: 700 }}>{key}</strong>: {note}
          </li>
        ))}
      </ul>
    </>
  );
}

function Body() {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: `${em(8)} ${em(6)} ${em(8)} 0` }}>
      <div
        style={{
          height: "100%",
          borderRadius: `${em(14)} ${em(14)} 0 0`,
          background: NB.paper,
          padding: `${em(20)} ${em(22)}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: em(10) }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {/* Whose memory this is. Two agents' `decisions.md` carry the same
                label, so the page is headed by its owner first. */}
            <div
              style={{
                fontSize: em(11),
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: NB.inkSoft,
              }}
            >
              Planner
            </div>
            <div
              style={{
                marginTop: em(2),
                fontSize: em(20),
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
              }}
            >
              Settled decisions
            </div>
          </div>
          <FiMoreHorizontal
            aria-hidden
            style={{ width: em(16), height: em(16), flex: "0 0 auto", color: NB.inkSoft }}
          />
        </div>

        <div
          style={{
            marginTop: em(14),
            borderRadius: em(13),
            border: `${em(1.5)} solid ${NB.ink}`,
            boxShadow: `${em(3)} ${em(3)} 0 0 ${NB.ink}`,
            background: NB.paper,
            padding: em(18),
          }}
        >
          <p style={{ margin: 0, fontSize: em(13), lineHeight: 1.6, color: NB.inkSoft }}>
            {"Settled answers to cards' open questions, grouped by topic."}
          </p>
          <Topic
            name="checkout"
            notes={[
              ["Guest checkout", "an email is enough; no account before the first order."],
              ["One page", "address, shipping and payment stay on one screen."],
            ]}
          />
          <Topic
            name="billing"
            notes={[["Currency", "prices show in the buyer's own currency, fixed at order time."]]}
          />
        </div>
      </div>
    </div>
  );
}

export function ShotMemory() {
  return (
    <Shot>
      {/* Pure `cqw`, without nb.tsx's legibility floor: this drawing is a whole
          window rather than a crop, so it has to scale exactly with the column
          it is given — at the floor it would outgrow a phone's prose width. */}
      <div
        style={{
          fontSize: `${((14 / W) * 100).toFixed(4)}cqw`,
          display: "flex",
          alignItems: "stretch",
          background: NB.cream,
        }}
      >
        <Rail />
        <Body />
      </div>
    </Shot>
  );
}
