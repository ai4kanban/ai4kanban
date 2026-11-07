import { Dialog as Primitive } from "radix-ui";
import { FiX } from "react-icons/fi";
import { cn } from "./utils";
import { POPUP } from "./popup";

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

export const OVERLAY = "fixed inset-0 z-50 bg-nb-ink/20";
export const CONTENT = cn(POPUP, "fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-32px)] w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[14px] p-6");

export function DialogContent({ className, children, closeLabel = "Close", ...props }: React.ComponentProps<typeof Primitive.Content> & { closeLabel?: string }) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className={OVERLAY} />
      <Primitive.Content className={cn(CONTENT, className)} {...props}>
        {children}
        <Primitive.Close aria-label={closeLabel} className="absolute right-5 top-5 cursor-pointer rounded-[7px] p-1 text-nb-ink-soft hover:bg-nb-ink/[0.06]">
          <FiX size={16} />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof Primitive.Title>) {
  return <Primitive.Title className={cn("pr-8 text-[17px] font-[800]", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.ComponentProps<typeof Primitive.Description>) {
  return <Primitive.Description className={cn("mt-1 text-[13px] text-nb-ink-soft", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />;
}
