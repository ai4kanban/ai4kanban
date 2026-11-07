import { cn } from "./utils";

export const FIELD = "flex h-9 w-full items-center rounded-[8px] border-[1.5px] border-nb-ink/25 bg-nb-paper px-3 text-[13px] text-nb-ink focus-visible:border-nb-accent";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(FIELD, "placeholder:text-nb-ink-soft disabled:opacity-50", className)} {...props} />;
}
