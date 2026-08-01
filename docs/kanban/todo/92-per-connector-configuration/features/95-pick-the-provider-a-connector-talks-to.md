---
title: Pick which provider a connector talks to
track: features
priority: med
roi: high
status: ready
release: next
blocked_by: []
related: [92]
modules: [local-ui]
questions: []
---

Every run goes through whatever account the agent's own CLI is logged into. Let the user
say who pays for a run instead — a subscription, an API key, or a gateway — so someone
without a Claude subscription can use the board.

## Today
- Claude Code takes one key, and it is always used when it is there (#94). Nothing else in
  the dialog moves a run off the account the `claude` CLI is logged into: no gateway, and no
  way to say "use the subscription this time" while a key is saved.
- Everything else is set by environment, and the `command` override sets flags, never
  environment. The only way left is to export the variables yourself before starting the UI
  server, which the server then passes to every run. That is one account for the whole
  board, it takes a restart to change, and the dialog never shows what it is.

## Scope
- Each connector ships its own list of providers. The dialog shows that list as one
  setting, and the pick is what a run then goes through.
- Claude Code's list is three entries:
  - **Claude subscription** — it uses the login the `claude` CLI already has, and needs
    nothing else.
  - **Anthropic API** — pay per token with the key from `docs/kanban/.env` (#94).
  - **Anthropic-compatible endpoint** — a gateway such as OpenRouter or LiteLLM, or a
    company proxy. It needs a base URL, and a key only if that gateway asks for one.
- A provider says which boxes it needs and the dialog shows only those. The subscription
  shows neither box. The Anthropic API shows the key box. The endpoint shows both.
- Saving the endpoint pick with an empty base URL is refused. An empty key is not: a key can
  be written into `docs/kanban/.env` by hand, so telling the user a provider has no key yet
  is #96's job, not a save-time block.
- Picking a provider sets the environment a run starts under. That is the only lever that
  actually moves Claude Code, so this is where it lives.
- The pick decides that environment whole. A run sees the variables the picked provider
  needs and nothing else that could move it — not the other two providers' variables, and
  not the ones for providers the board doesn't offer yet. Otherwise a base URL the user
  exported months ago would still send a "Claude subscription" run through a gateway, with
  the dialog saying otherwise.
- Changing the pick keeps what you already typed. The base URL and the key stay where they
  are, and only what the new pick needs reaches the next run, so flipping between two
  providers never asks you to type either one again.
- Say what a connector can reach, plainly. Claude Code speaks the Anthropic API only, so
  "OpenAI" is not on its list — an OpenAI model reaches it through a gateway that answers
  in the Anthropic format, which is the endpoint entry. A connector that speaks the OpenAI
  format can bring its own list.
- The subscription is the default, except on a board that already holds an Anthropic key,
  which reads as the Anthropic API. Either way, a user who changes nothing keeps the runs
  they have today.
- Amazon Bedrock, Google Vertex and Microsoft Foundry are out of scope. They are more
  entries on the same list; add them when someone asks.

## Todo
- [x] Let a connector declare a provider list, and show it as a setting in the
      Configuration dialog.
- [x] Give Claude Code its three providers, and start a run under the environment the
      picked one needs.
- [x] Let a run see only the variables the pick sets, so nothing the user exported in their
      shell can move it somewhere else — including exports for providers the board doesn't
      offer.
- [x] Show each provider only the boxes it needs: the base URL for the endpoint, the key for
      the Anthropic API and the endpoint, neither for the subscription.
- [x] Refuse to save the endpoint pick while the base URL box is empty.
- [x] Keep the base URL and the key when the pick changes, so flipping providers never asks
      for either one twice.
- [x] Default to the subscription, and to the Anthropic API on a board that already holds a
      key, so an untouched board runs exactly as it does today.
- [x] Update `kanban-ui/README.md`: the provider list, which boxes each one needs, that the
      key now belongs to a provider, and that Claude Code only reaches an OpenAI model
      through an Anthropic-format gateway.
- [ ] Run a card end to end on each of the three: the subscription, a real Anthropic API
      key, and one gateway base URL.
- [ ] Export a gateway base URL in the shell, start the server, pick the subscription, and
      check the run goes to the subscription.
- [ ] On a board that saved a key before this shipped and has never picked a provider, run a
      card and check it still uses that key.

## Decided by the agent
- **Where does the API key box from #94 go?** Under the providers that need it. The
  Anthropic API needs it, an endpoint may need it, the subscription never does — so the box
  shows for the first two and is gone for the third, the same way the base URL box is.
- **Is a key required for the endpoint?** No. A company proxy, or a LiteLLM running on the
  same laptop, often takes none. The base URL is what makes that pick mean anything, so the
  base URL is required and the key is not.
- **Does an empty box ever block the save?** Only the base URL, which the board owns and
  writes. A key can be written into `docs/kanban/.env` by hand at any time, so the board
  can't call it missing at save time — reporting a provider with no key is #96's.
- **What happens on a board that saved a key before this shipped?** It reads as the
  Anthropic API provider until the user picks something else. Defaulting it to the
  subscription would drop that key from every run, which is the opposite of "a user who
  changes nothing sees no change".
- **Does changing the pick clear what was typed for the old one?** No. The base URL and the
  key stay. They belong to the box they were typed in, not to whoever was picked at the
  time — the same rule the key already follows when the connector is switched.
- **How far does dropping variables go?** To everything that could move Claude Code, not
  only to what the other two providers use. An exported Bedrock or Vertex variable is a
  provider the board doesn't offer, and leaving it in place would send a "Claude
  subscription" run somewhere else — the exact thing this card exists to stop.
- **Are the user's cloud credentials dropped too?** No — only the switches that turn a cloud
  provider on. `AWS_PROFILE` or a Google credentials path moves nothing once the switch above
  it is gone, and the agent may well need them for the work it is doing in the repo. Taking
  them away would break someone's build to fix a problem they don't have.
- **How do you pick the endpoint, when its base URL box only shows once it is picked?** The
  pick waits. Choosing it draws the boxes it needs at once, and says it isn't saved yet; the
  moment the base URL is filled in, the pick saves itself. Nothing half-picked is ever
  written, so closing the dialog there leaves the old provider running.
- **Can the base URL be emptied while the endpoint is picked?** No, and it is refused with
  the same message. Otherwise the file would hold a pick that points nowhere — the thing
  refusing the save was meant to prevent, arrived at from the other side.
- **Which variable does a gateway's key go out under?** Both the ones Claude Code reads:
  `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN`. Which header a gateway checks is its own
  team's choice, the board has no way to ask, and a second box asking the user to know would
  be worse than sending the same key twice.
- **What happens to a provider hand-written into the file that we don't ship?** It reads as
  the default, the same as no pick at all. A run always goes through one provider, so there
  is no "nothing picked" state for a typo to land in, and the dialog then shows the provider
  the run will really use.
- **Does Codex get a provider list in this card?** No. It speaks the OpenAI format and brings
  its own list, as the scope says. Until it does it declares none, so its runs inherit the
  environment exactly as they do today.
