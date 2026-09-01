import { FaApple, FaWindows } from "react-icons/fa";
import { SiLinux } from "react-icons/si";
import type { IconType } from "react-icons";
import type { OS } from "./builds";

/** The mark for each system — on the download cards and inside the button. It
 *  lives apart from `builds.ts` because that module reaches the release through
 *  `lib/release.ts`, which reads the version off disk: a client component can
 *  take a type from there, never a value.
 *
 *  Tux comes from Simple Icons, not Font Awesome: the Fa one is drawn in
 *  outline and reads as a different weight beside two solid marks. */
export const SYSTEM_ICON: Record<OS, IconType> = {
  mac: FaApple,
  windows: FaWindows,
  linux: SiLinux,
};
