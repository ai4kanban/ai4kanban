"use client";

// What a card page asks git for — the Implement plan and a delivery's Diff — read once the
// page is drawn, so the card never waits on git. Read again whenever the page is (`key`
// changes on every server re-read); the last answer stays on screen until the new one lands.

import { useEffect, useState } from "react";
import { poll } from "@/lib/poll";
import type { DeliveryDiff, DeliveryPlan } from "@/lib/types";

interface DeliveryReads {
  plan: DeliveryPlan | null;
  diff: DeliveryDiff | null;
}

const NONE: DeliveryReads = { plan: null, diff: null };

export function useDeliveryReads(
  key: unknown,
  { cardId, deliveryId }: { cardId?: number; deliveryId?: string },
): DeliveryReads {
  const [read, setRead] = useState<DeliveryReads & { of: string }>({ ...NONE, of: "" });
  const of = `${cardId ?? ""}:${deliveryId ?? ""}`;
  useEffect(() => {
    let live = true;
    const query = new URLSearchParams({
      ...(cardId === undefined ? {} : { card: String(cardId) }),
      ...(deliveryId ? { delivery: deliveryId } : {}),
    });
    poll<DeliveryReads>(`/poll/delivery?${query}`)
      // A failed read still lets Implement open; its dialog then names no branch.
      .catch((): DeliveryReads => ({ plan: cardId === undefined ? null : { commitMode: "auto" }, diff: null }))
      .then((got) => {
        if (live) setRead({ ...got, of });
      });
    return () => {
      live = false;
    };
  }, [key, cardId, deliveryId, of]);
  // Another card's answer is never this one's.
  return read.of === of ? read : NONE;
}
