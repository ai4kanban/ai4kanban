# Redesign

Design mistakes to avoid when writing a card: the mistake, then the design we want. Read before writing or reviewing a card.

## UI text

- ❌ **标签已经说明状态，旁边再写一句没有信息的理由凑数** → ✅ 没有可补充的就不写；要写就给出具体依据。
- ❌ **提示语解释机制（存在哪、怎么同步）或说空话** → ✅ 价值优先、并列直说选择，如「直接丢弃，或写下原因，未来会避开这类任务」。

## What the UI does

- ❌ **The UI hand-edits the board** → ✅ it spawns agent runs for kanban work; only card settings such as priority, ROI and release are direct.
- ❌ **An action stays terminal-only because it feels rare or administrative** → ✅ the UI offers what the command offers, showing consequences before confirming.
- ❌ **A control is kept for leftover cases after its purpose is replaced** → ✅ route each leftover elsewhere, then remove it.
- ❌ **An automatic feature also gets a "run it on this" button** → ✅ automatic features are switched on or off, never aimed by hand.
- ❌ **The app's own controls go through the network so every surface shares one path** → ✅ a control on the board's machine acts at once and syncs afterwards.
- ❌ **An external service is the only place to see and test notifications** → ✅ prove them in the app's own notification center; connectors reuse it.
- ❌ **A feature ships with an app-wide keyboard shortcut** → ✅ reach it from the control on screen; a first global key is its own card.
- ❌ **A new expressive view replaces the plain list** → ✅ it sits beside the list, which never goes away.
- ❌ **A control that starts a run offers only fixed choices** → ✅ add a free-text note carried into the run.
- ❌ **A control is disabled with no reason shown** → ✅ every disabled state says why.
- ❌ **A new screen gains an action nobody asked for (Customize on a built-in memory)** → ✅ scope only what the request names.
- ❌ **Archiving the discussion you're viewing leaves it open** → ✅ return to New idea; archiving another never interrupts your view.

## Runs and deliveries

- ❌ **Waiting on a blocker is built for one action** → ✅ scheduling is a modifier on any action.
- ❌ **Editing a card mid-delivery retires the delivery** → ✅ deliver the approved snapshot and hold the card.
- ❌ **Two controls that end the same thing side by side** → ✅ one control whose confirmation names what is lost.
- ❌ **Discussion closes on click before the run starts** → ✅ close on the real start; a refused start stays with its reason.
- ❌ **Agents notify while the card still has follow-up work** → ✅ notify once the card's whole chain ends and needs a person.

## Settings

- ❌ **A background sweep with its own switch for work a run causes** → ✅ the work follows the run; no sweep, no switch.
- ❌ **A board-wide setting ships with a per-card override** → ✅ ship the setting alone until a card must differ.
- ❌ **Checking a setup's pieces to say whether it can run** → ✅ one Test button that really runs it once.
- ❌ **A form omits fields it can't save yet and explains why** → ✅ draw the whole form and hold what can't be written; needing to explain the order means the order is wrong.
- ❌ **An optional schedule takes a full settings row** → ✅ a compact control beside the manual action, reusing the scheduled agent's parts.
- ❌ **Agents added to, removed from or shared across workflows** → ✅ each workflow owns its agents and only switches them; reuse is a copy.
- ❌ **A switch or field repeated across scopes** → ✅ each switch lives in one place; only the selected agent shows its extra requirements.

## Shipping the desktop app

- ❌ **A release waits on a paid developer account** → ✅ ship unsigned with the bypass clicks documented; signing never gates a release.
- ❌ **A platform is dropped because a library's path there needs a signature** → ✅ check what the system lets an unsigned build do first.
- ❌ **A gesture needs a system setting turned on** → ✅ a gesture people already use in browsers works with no setup.
- ❌ **A password prompt for a write needing no privilege** → ✅ link into a user-owned PATH folder, privileged path as fallback, never edit shell startup files.
- ❌ **A check that can only run after release** → ✅ scope a local way to exercise it, failure cases included.
- ❌ **An update failure sends users to a manual download** → ✅ retry network failures silently, then show only a confirmed cause.

## Triage and feedback

- ❌ **A heading per source over the triage items** → ✅ a compact list with a detail pane, built for clearing hundreds of alike items fast.
- ❌ **One board-wide endpoint form instead of source selection** → ✅ independent optional sources; collection controls stay with the collection agent.
- ❌ **Reporting a problem means picking internal runs or reading infrastructure** → ✅ start from Discuss, optionally link an earlier card, and name only team, sharing scope and outcome.
- ❌ **Feedback results shown in a chat that ending clears** → ✅ submit on end, with no sent/failed/retry states.

## Designing against the app that exists

- ❌ **A spec targets a dialog the app no longer has** → ✅ inspect the current screen before designing into it.
- ❌ **A card replacing a whole screen describes it in prose** → ✅ draw the screen first; scope says what it does, not how it looks.
- ❌ **Moving records and logs into new containers becomes a redesign** → ✅ reuse their components; change only the containers.
- ❌ **A mobile mockup is a phone-width column on a desktop canvas** → ✅ draw it in a real narrow viewport.
