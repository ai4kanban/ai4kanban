# Storyboard contract

Use `storyboard.schema.json` and `storyboard.example.json` beside this reference; both are
maintained with and tested by the shared validator. Save JSON alone, without fences or comments, in the
same-card storyboard attachment.

- **Required fields**: version 1 and ordered shots; each shot supplies id, start, end,
  voiceover, action, captions, details and frames: up to two, or an explicit empty array.
  Unknown fields are errors.
- **Speech**: voiceover mode is none with no other fields, or spoken with nonblank text and
  source. Never replace a missing field with null, blank text or a guessed default.
- **Content**: action states what changes or deliberately stays still; captions lists exact
  screen text, or an explicit empty array. Details defines layout, framing, typography, sound,
  motion and transitions, and links reusable frame sources. Frame entries contain only a
  same-card src and descriptive alt. If more visual references are needed, link additional
  same-card frames in details; frame limits do not determine shot boundaries.
- **Timing**: unique stable S-number IDs, finite seconds, positive durations, starting at zero
  with consecutive shots meeting at their boundaries; the array determines playback order.
- **Repair**: run `akb raw validate <card id> --json`; fix every field or asset named by its
  diagnostics in this same session and rerun. Request approval only after the current files
  pass. Do not treat structural validity as proof of creative quality or production readiness.
