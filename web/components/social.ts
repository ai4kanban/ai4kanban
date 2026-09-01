// Tao's profiles. One list, two readers: the builder page's icon row and the
// `sameAs` array in that page's Person node — so a new profile is added once and
// the structured data can't fall behind.
import { GITHUB_URL } from "./content";
import { FaGithub, FaLinkedinIn, FaXTwitter } from "react-icons/fa6";
import { FiGlobe } from "react-icons/fi";

export const BUILDER_PATH = "/builder";

export const X_HANDLE = "@tao_pmf";

export const SOCIALS = [
  {
    href: "https://www.linkedin.com/in/tao-pmf",
    label: "LinkedIn",
    Icon: FaLinkedinIn,
  },
  {
    href: "https://github.com/neverchanje/",
    label: "GitHub",
    Icon: FaGithub,
  },
  { href: "https://x.com/tao_pmf", label: "X", Icon: FaXTwitter },
  {
    href: "https://tao-wu-me.pages.dev/",
    label: "Tao Wu's website",
    Icon: FiGlobe,
  },
] as const;

export const SOCIAL_URLS = SOCIALS.map((s) => s.href);

// What the footer shows. Tao's own site is off the list — a second globe beside
// the language switcher reads as a duplicate control — and the GitHub mark goes
// to the project, which is what a visitor down there is looking for.
export const FOOTER_SOCIALS = [
  {
    href: "https://www.linkedin.com/in/tao-pmf",
    label: "LinkedIn",
    Icon: FaLinkedinIn,
  },
  { href: GITHUB_URL, label: "GitHub", Icon: FaGithub },
  { href: "https://x.com/tao_pmf", label: "X", Icon: FaXTwitter },
] as const;
