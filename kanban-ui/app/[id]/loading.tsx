"use client";

import { useParams } from "next/navigation";
import { CardOpening } from "@/components/CardOpening";

// Drawn the moment a card is clicked, while the server reads it (#906).
export default function Loading() {
  const { id } = useParams<{ id: string }>();
  return <CardOpening id={Number(id)} />;
}
