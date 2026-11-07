import { Label as Primitive } from "radix-ui";
import { cn } from "./utils";

export function Label({ className, ...props }: React.ComponentProps<typeof Primitive.Root>) {
  return <Primitive.Root className={cn("flex items-center gap-1.5 text-[12px] font-[700] text-nb-ink", className)} {...props} />;
}
