import {
  FiBookOpen,
  FiCompass,
  FiCpu,
  FiDownload,
  FiGitBranch,
  FiLayers,
  FiMessageSquare,
  FiPackage,
  FiRepeat,
  FiSettings,
  FiTarget,
  FiTerminal,
} from "react-icons/fi";
import type { IconType } from "react-icons";

// The names a page may set in its frontmatter (`icon:`) or on a <Card icon="…">.
// A closed set, shared by the rail and the navigation cards so both resolve the
// same name the same way; anything unknown falls back to a neutral page glyph.
const DOC_ICONS: Record<string, IconType> = {
  compass: FiCompass,
  target: FiTarget,
  repeat: FiRepeat,
  cpu: FiCpu,
  terminal: FiTerminal,
  settings: FiSettings,
  layers: FiLayers,
  "git-branch": FiGitBranch,
  message: FiMessageSquare,
  package: FiPackage,
  download: FiDownload,
};

export function docIcon(name?: string): IconType {
  return (name && DOC_ICONS[name]) || FiBookOpen;
}
