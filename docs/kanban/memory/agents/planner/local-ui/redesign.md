# Redesign

Design mistakes to avoid when writing a card: the mistake, then the design we want. Read before writing or reviewing a card.

- ❌ **标签已经说明状态，旁边再写一句没有信息的理由凑数（「待你判断」配「拿不准」）** → ✅ 没有可补充的就不写；要写就给出具体依据，例如把握度的数值。

- ❌ **提示语解释机制（存在哪、怎么同步）或说空话（「留空则不记录」）** → ✅ 价值优先、并列直说两个选择，如「直接丢弃，或写下原因，未来会避开这类任务」。

## What the UI does

- ❌ **The UI hand-edits the board** → ✅ it spawns agent runs for kanban work; only card settings such as priority, ROI and release are direct.
- ❌ **An action stays terminal-only because it feels rare or administrative** → ✅ the UI offers what the command offers, showing consequences before confirming.
- ❌ **A control is kept for leftover cases after its purpose is replaced** → ✅ route each leftover elsewhere, then remove it.
- ❌ **An automatic feature also gets a "run it on this" button** → ✅ automatic features are switched on or off, never aimed by hand.
- ❌ **The app's own controls go through the network so every surface shares one path** → ✅ a control on the board's machine acts at once and syncs afterwards.
- ❌ **An external service is the only place to see and test notifications** → ✅ prove events, messages and actions in the app's own notification center; connectors reuse it.
- ❌ **A feature ships with an app-wide keyboard shortcut** → ✅ reach it from the control on screen; a first global key is its own card.
- ❌ **A new expressive view replaces the plain list** → ✅ it sits beside the list, which never goes away.
- ❌ **A card replacing a whole screen describes its parts in prose** → ✅ draw the screen before settling the card; scope says what it does, not how it looks.
- ❌ **A control that starts a run offers only fixed choices** → ✅ add a free-text note carried into the run.
- ❌ **A control is disabled with no reason shown** → ✅ every disabled state says why in a tooltip.
- ❌ **Archiving the discussion you're viewing leaves it open** → ✅ return to New idea; archiving another never interrupts your view.

## Runs and deliveries

- ❌ **A run's log is transient** → ✅ it is saved, reopenable after restart, and browsable live and past in one runs panel.
- ❌ **A run's result waits for accept or discard** → ✅ a run changes the board when it finishes; the user reads the log.
- ❌ **Waiting on a blocker is built for one action** → ✅ scheduling is a modifier on any action.
- ❌ **Editing a card mid-delivery retires the delivery** → ✅ deliver the approved snapshot and hold the card.
- ❌ **Two controls that end the same thing side by side** → ✅ one question at a time; one control whose confirmation names what is lost.
- ❌ **Discussion closes on click before the run starts** → ✅ show Starting… and close on the real start; a refused start stays with its reason.
- ❌ **Agents notify each other while the card still has follow-up work** → ✅ notify once the card's whole chain ends and needs a person.

## Settings

- ❌ **Each global setting gets a header control** → ✅ one gear, one Configuration dialog.
- ❌ **A background sweep with its own switch for work a run causes** → ✅ the work follows the run; no sweep, no switch.
- ❌ **A board-wide setting ships with a per-card override** → ✅ ship the setting alone until a card must differ.
- ❌ **Checking a setup's pieces to say whether it can run** → ✅ one Test button that really runs it once.
- ❌ **A form omits fields it can't save yet and explains why** → ✅ draw the whole form and hold what can't be written; needing to explain the order means the order is wrong.
- ❌ **Telemetry asked over the board, or a permanent Privacy tab** → ✅ one default-on disclosure step in onboarding, once per machine, then just a switch under General.
- ❌ **An optional schedule takes a full settings row** → ✅ a compact control beside the manual action, reusing the existing scheduled agent's parts.
- ❌ **Every workflow field at once, or flows on separate pages** → ✅ usable defaults; always the rail and Plan → Execute tabs, even for one flow; name new flows and copies inline on blur; built-ins can't be renamed or deleted.
- ❌ **Agents added to, removed from or shared across workflows** → ✅ each workflow owns its agents, the lead included, and only switches them; reuse is a copy, and copying a workflow copies its agents.
- ❌ **Agent creation and runtime settings mixed into a workflow, or a field repeated across scopes** → ✅ only the selected agent shows its extra requirements, and each switch lives in one place.

## Keys

- ❌ **A key comes from whatever was exported before the server started** → ✅ keys live only in the board's gitignored `.env`, are never shown back, and deleting a runtime removes its keys (the confirmation says so).
- ❌ **A key is sent under every variable the agent might read** → ✅ one auth variable per run, the one the chosen provider names.

## Recurring tasks

- ❌ **Recurring tasks only add a Run button** → ✅ the server's dispatcher runs due scheduled agents on a cadence; never an in-session loop.
- ❌ **Scheduling is preset-only or a mandatory form** → ✅ one menu of common cadences and Off, with Custom for number, unit and time.

## Shipping the desktop app

- ❌ **A release waits on a paid developer account** → ✅ ship unsigned with the bypass clicks documented; signing is a follow-up, never a gate.
- ❌ **A platform is dropped because a library's path there needs a signature** → ✅ check what the system lets an unsigned build do first.
- ❌ **A gesture needs a system setting turned on** → ✅ a gesture people already use in browsers works with no setup.
- ❌ **A password prompt on every machine, or for a write needing no privilege** → ✅ link into a user-owned PATH folder, privileged path as fallback, never edit shell startup files.
- ❌ **A check that can only run after release** → ✅ scope a local way to exercise it, failure cases included.
- ❌ **An update failure sends users to a manual download** → ✅ keep updates automatic: retry network failures silently, then show only a confirmed cause.

## Triage and feedback

- ❌ **A heading per source card over the triage items** (most sources yield one) → ✅ a compact list with a detail pane, built for clearing hundreds of alike items fast.
- ❌ **One board-wide endpoint form instead of source selection** → ✅ independent optional sources with attribution; collection controls stay with the collection agent.
- ❌ **Reporting a problem means picking internal runs or reading infrastructure** → ✅ start from Discuss, optionally link an earlier card, and name only team, sharing scope and outcome; the card picker appears only while sharing is on.
- ❌ **Feedback results shown in a chat that ending clears** → ✅ submit on end, with no sent/failed/retry states.

## Designing against the app that exists

- ❌ **A spec targets a dialog the app no longer has** → ✅ inspect the current screen before designing into it.
- ❌ **Moving records and logs into new containers becomes a redesign** → ✅ reuse their components; change only the containers.
- ❌ **A mobile mockup is a phone-width column on a desktop canvas** → ✅ draw it in a real narrow viewport.
