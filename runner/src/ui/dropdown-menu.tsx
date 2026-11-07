import { DropdownMenu as Primitive } from "radix-ui";
import { cn } from "./utils";
import { ITEM, POPUP } from "./popup";

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuGroup = Primitive.Group;

export function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(POPUP, "flex max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[160px] flex-col overflow-y-auto p-1", className)}
        {...props}
      />
    </Primitive.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof Primitive.Item>) {
  return <Primitive.Item className={cn(ITEM, className)} {...props} />;
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof Primitive.Label>) {
  return <Primitive.Label className={cn("px-2.5 pb-1 pt-1.5 text-[11.5px] font-[600] text-nb-ink-soft", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator className={cn("mx-1 my-1 h-px shrink-0 bg-nb-ink/10", className)} {...props} />;
}
