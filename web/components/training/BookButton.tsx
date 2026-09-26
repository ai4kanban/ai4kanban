"use client";

import type { ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import type { ServiceId } from "./state";

export const BOOKING_ANCHOR = "booking";

/** Fired with a `ServiceId`; `Booking` sets it on the form, open or not yet. */
export const CHOOSE_SERVICE = "training:choose-service";

/** A price card's button: scrolls to the week with its service chosen. */
export function BookButton({
  service,
  variant,
  children,
}: {
  service: ServiceId;
  variant: ButtonVariant;
  children: ReactNode;
}) {
  return (
    <Button
      href={`#${BOOKING_ANCHOR}`}
      variant={variant}
      className="w-full"
      onClick={() => window.dispatchEvent(new CustomEvent(CHOOSE_SERVICE, { detail: service }))}
    >
      {children}
    </Button>
  );
}
