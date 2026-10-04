/** One page of the welcome tour (#1500): the pain it answers, the answer, and — where the
 *  answer costs tokens in the background — what it costs and where to turn it off. */
export type TourPage = {
  title: string;
  /** A small tag beside the title. */
  tag?: string;
  pain: string;
  value: string;
  note?: string;
};

/** The welcome tour, its five animations' short words, and the row that reopens it. */
export type TourCopy = {
  dialog: string;
  noteLabel: string;
  skip: string;
  back: string;
  next: string;
  done: string;
  pages: TourPage[];
  draft: { idea: string; spec: string; skip: string; approve: string; approved: string };
  gaps: { main: string; done: string; found: string; rows: string[]; add: string; added: string };
  flows: { doing: string; done: string; cards: string[] };
  memory: { says: string[]; agents: string; modules: string; files: string[] };
  qa: { signup: string; email: string; export: string; steps: string[]; label: string; feedback: string };
  /** Configuration → General, and Cloud's settings page. */
  replay: { note: string; button: string };
};
