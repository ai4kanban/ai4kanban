import { Select as Primitive } from "radix-ui";
import { FiCheck, FiChevronDown } from "react-icons/fi";
import { cn } from "./utils";
import { FIELD } from "./input";
import { ITEM, POPUP } from "./popup";

export const Select = Primitive.Root;
export const SelectValue = Primitive.Value;

export function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger className={cn(FIELD, "cursor-pointer justify-between gap-2 data-[placeholder]:text-nb-ink-soft", className)} {...props}>
      <span className="truncate">{children}</span>
      <Primitive.Icon asChild>
        <FiChevronDown size={13} className="shrink-0 text-nb-ink-soft" />
      </Primitive.Icon>
    </Primitive.Trigger>
  );
}

export function SelectContent({ className, children, ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        position="popper"
        sideOffset={6}
        collisionPadding={8}
        className={cn(POPUP, "max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-y-auto", className)}
        {...props}
      >
        <Primitive.Viewport className="p-1">{children}</Primitive.Viewport>
      </Primitive.Content>
    </Primitive.Portal>
  );
}

export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item className={cn(ITEM, "pr-8", className)} {...props}>
      <Primitive.ItemText>{children}</Primitive.ItemText>
      <Primitive.ItemIndicator className="absolute right-2.5 inline-flex">
        <FiCheck size={13} />
      </Primitive.ItemIndicator>
    </Primitive.Item>
  );
}
