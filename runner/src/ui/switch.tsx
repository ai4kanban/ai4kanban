import { Switch as Primitive } from "radix-ui";
import { cn } from "./utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      className={cn("inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full bg-nb-ink/15 p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-nb-accent", className)}
      {...props}
    >
      <Primitive.Thumb className="block size-3.5 rounded-full bg-nb-paper shadow-sm transition-transform data-[state=checked]:translate-x-3.5" />
    </Primitive.Root>
  );
}
