import { Tooltip as Primitive } from "radix-ui";
import { cn } from "./utils";

export const TooltipProvider = Primitive.Provider;
export const Tooltip = Primitive.Root;
export const TooltipTrigger = Primitive.Trigger;

export function TooltipContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn("z-50 max-w-[260px] rounded-[7px] bg-nb-ink px-2.5 py-1.5 text-[12px] leading-snug text-nb-paper", className)}
        {...props}
      />
    </Primitive.Portal>
  );
}
