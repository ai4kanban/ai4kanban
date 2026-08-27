// The shape of the board UI's copy: `UiCopy` joins one type per surface. Each
// surface's own shape lives beside its words — `board/types.ts`, `card/types.ts`,
// and so on.
//
// Every language declares these same types, so a key English adds and a language
// hasn't translated yet is a build error rather than a blank on screen.
import type { BoardCopy } from "./board/types";
import type { CardCopy } from "./card/types";
import type { ChatCopy } from "./chat/types";
import type { ChipsCopy } from "./chips/types";
import type { ChromeCopy } from "./chrome/types";
import type { ConfigurationCopy } from "./configuration/types";
import type { MessagesCopy } from "./messages/types";
import type { RailCopy } from "./rail/types";
import type { RunsCopy } from "./runs/types";
import type { SetupCopy } from "./setup/types";
import type { SharedCopy } from "./shared/types";

/** Every word the board UI renders, in one language. */
export type UiCopy = {
  shared: SharedCopy;
  chips: ChipsCopy;
  chrome: ChromeCopy;
  board: BoardCopy;
  card: CardCopy;
  runs: RunsCopy;
  chat: ChatCopy;
  setup: SetupCopy;
  configuration: ConfigurationCopy;
  rail: RailCopy;
  messages: MessagesCopy;
};
