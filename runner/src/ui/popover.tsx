import { Popover as Primitive } from "radix-ui";
import { cn } from "./utils";
import { POPUP } from "./popup";

export const Popover = Primitive.Root;
export const PopoverTrigger = Primitive.Trigger;
export const PopoverAnchor = Primitive.Anchor;
export const PopoverClose = Primitive.Close;

export function PopoverContent({ className, sideOffset = 8, ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content sideOffset={sideOffset} collisionPadding={12} className={cn(POPUP, "w-[280px] max-w-[calc(100vw-24px)] p-4 text-[13px]", className)} {...props} />
    </Primitive.Portal>
  );
}
