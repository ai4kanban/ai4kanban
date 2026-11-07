import { AlertDialog as Primitive } from "radix-ui";
import { cn } from "./utils";
import { buttonVariants } from "./button";
import { CONTENT, OVERLAY } from "./dialog";

export const AlertDialog = Primitive.Root;
export const AlertDialogTrigger = Primitive.Trigger;

export function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className={OVERLAY} />
      <Primitive.Content className={cn(CONTENT, className)} {...props} />
    </Primitive.Portal>
  );
}

export function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof Primitive.Title>) {
  return <Primitive.Title className={cn("text-[17px] font-[800]", className)} {...props} />;
}

export function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof Primitive.Description>) {
  return <Primitive.Description className={cn("mt-1 text-[13px] text-nb-ink-soft", className)} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />;
}

export function AlertDialogAction({ className, ...props }: React.ComponentProps<typeof Primitive.Action>) {
  return <Primitive.Action className={cn(buttonVariants({ variant: "accent" }), className)} {...props} />;
}

export function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof Primitive.Cancel>) {
  return <Primitive.Cancel className={cn(buttonVariants({ variant: "outline" }), className)} {...props} />;
}
