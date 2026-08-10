import type { PageMeta } from "../types";

/**
 * The download page — where a person gets the board as an app.
 *
 * Nothing positional is copy: which build belongs to which system, the file
 * extensions, and the release URL all stay in `components/pages/DownloadPage.tsx`.
 * What is here is the words around them.
 */
export type DownloadCopy = {
  meta: PageMeta;
  hero: {
    title: string;
    lead: string;
    cta: string;
    /** Under the button: what you still need on the machine to start runs. */
    note: string;
  };
  /** The table of builds. The system names and file types are not copy. */
  builds: {
    title: string;
    lead: string;
    columns: { system: string; file: string; signed: string; tested: string };
    yes: string;
    no: string;
    /** The three systems, in the order the table lists them. */
    systems: [string, string, string];
  };
  /** Opening a build the system warns about — one short step each. */
  unsigned: {
    title: string;
    lead: string;
    windows: { title: string; body: string };
    linux: { title: string; body: string };
  };
  /** What happens after the download: which project, and newer versions. */
  using: {
    title: string;
    /** Two short paragraphs: picking a project, and how updates work. */
    items: [TitleBodyPair, TitleBodyPair];
  };
  /** The old way, said plainly once. */
  deprecated: {
    title: string;
    body: string;
  };
};

type TitleBodyPair = { title: string; body: string };
