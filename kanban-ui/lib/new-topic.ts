// The topic a New topic press just wrote, on its way to that topic's page (#507).
//
// One press has to write the card, open its page and put the cursor in the Source pane. The
// first two are a server action and `router.push`; the third happens a render later, on a
// page that has no way of knowing it was just made — every other way into a topic is a
// reader opening one they already have, and stealing the focus there would take the caret
// out of whatever they were doing.
//
// So the press leaves a mark and the page takes it, the way following a search match does
// (lib/agent-half.ts). A module variable dies with the page, so a reload is an ordinary
// visit again — which is right: the editor is focused because you just made this topic, not
// because it is this topic.

let armed: number | null = null;

/** Say the next visit to this topic's page is the one that made it. */
export function armNewTopic(id: number): void {
  armed = id;
}

/** Whether this page is that visit. Answers once — a re-render is not a second press. */
export function takeNewTopic(id: number): boolean {
  const mine = armed === id;
  if (mine) armed = null;
  return mine;
}
