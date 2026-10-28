import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// The standard shadcn class helper: merge conditional classes, then resolve
// Tailwind conflicts so later utilities win.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
