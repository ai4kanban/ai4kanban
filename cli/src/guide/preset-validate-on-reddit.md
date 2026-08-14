# Validate a move on Reddit

Use for a **validation** task that says to test a product decision, feature, or
move by posting to Reddit before building.

You draft the Reddit posts and scaffold the results doc. The user posts manually
and pastes replies back; then you write the verdict.

## Steps

1. **State the goal** — what decision the replies should inform. Soft criteria
   are fine; judge the verdict yourself when replies come in.
2. **Follow the post style** (below).
3. **Draft the probes** that fit. Common ones:
   - **Discovery** — unbiased question, no product mention, no links. Reveals
     what they actually do.
   - **Reaction** — share the product, force a choice between the option under
     test and its nearest alternative.
   One probe or several, whatever fits the goal.
4. **Scaffold** `docs/validations/<slug>.md` (or wherever you keep validation
   write-ups): Goal, each probe, a Results table each, empty Verdict. Raw posts go in
   ``` blocks.
5. **Write the Verdict** from the pasted replies.

## Rules

- Ask which subreddits the account can post in. Suggest, but don't assume.
- Don't pad the verdict — if signal is thin or negative, say so.
- Don't invent replies.

## Post writing style

<!-- Expand with examples of posts that landed and flopped, per subreddit. -->

### Voice

- Write like a quick comment typed in the moment, not edited copy. Casual, no marketing tone,
  no hype words.
- Short: a title under ~10 words and 2–4 plain sentences. Long posts read as ads.
- Title is one plain question. No em-dashes,
  no slashes, no "X — do you A or B?" headline construction. Just the question.
- Imperfect on purpose: the odd sentence fragment, drop the wind-up. This is
  genuine casual voice — NOT faked typos or misspellings. Don't manufacture
  errors; just stop polishing.
- First person. State the situation plainly, list the options you're considering
  if that helps, then ask what they usually do and what they last tried. Avoid
  invented backstory and dramatic self-talk like "part of me..." or "I'm torn..."
  because it reads staged. Don't narrate what "some people" do — that reads like
  a survey.
- Open straight with the situation or the question. Cut "I've been thinking
  about…", "curious what people think", and every other warm-up line.

### Background

- Ground it in one concrete situation, not a generic framing. "same complaint
  keeps coming up from users" beats "when problems arise in your business."
- Give only enough for someone to answer from experience. Skip the rest — no
  paragraph of setup, no explaining why you're asking.

### The question

- One specific question answerable from experience ("what's the last one you
  actually made?") beats a vague "what do you think?".
- Ask what they *did*, not what they *think*.

### Probe A — unbiased

- No product mention, no links.
- List the options flat and neutral so you don't lead the answer.

### Probe B — reaction

- One line on what the product does, then the link. Say it's yours — don't hide
  that you built it.
- Force a choice between the thing under test and its nearest alternative.

### Gets a post removed

- Self-promo in a no-promo sub, or "I'm doing research" survey framing.
- Low-karma / new accounts can't post in many subs (AutoModerator checks age and
  karma before a human sees it) — ask first.
- Read each sub's rules; they differ. Same post pasted across subs reads as spam.
