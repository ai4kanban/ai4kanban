// The calendar file a confirmed booking hands over (#683).
//
// Written in the browser rather than served: the site is a static export, and an
// `.ics` is a dozen lines of text the page already holds every field of. The
// event is stamped in UTC (`...Z`), which is the one form every calendar reads
// the same way — no VTIMEZONE block, and no chance of a zone name the reader's
// calendar does not know.

const SESSION_MS = 60 * 60_000;

/** `20260918T140000Z`. */
function stamp(at: Date): string {
  return `${at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`;
}

/** RFC 5545 folds long lines and escapes four characters. Both matter: an
 *  unescaped comma silently truncates a field in some calendars. */
function escape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function calendarFile(input: {
  reference: string;
  startsAt: Date;
  summary: string;
  description: string;
}): string {
  const ends = new Date(input.startsAt.getTime() + SESSION_MS);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AI4Kanban//Training//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.reference}@ai4kanban.dev`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(input.startsAt)}`,
    `DTEND:${stamp(ends)}`,
    `SUMMARY:${escape(input.summary)}`,
    `DESCRIPTION:${escape(input.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** Hand the file to the browser. A blob URL rather than a data URI: Safari will
 *  not download a `data:text/calendar`, it navigates to it. */
export function downloadCalendar(reference: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ai4kanban-${reference}.ics`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
