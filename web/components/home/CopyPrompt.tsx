"use client";

import { useState } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";
import { Button } from "./Button";

// The install CTA is a copy button, not a link — there's nowhere to go, the
// prompt is the product. Labels come in as props because this runs on the client.
export function CopyPrompt({
  text,
  label,
  copiedLabel,
}: {
  text: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts (e.g. plain http).
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch (err) {
      console.error("Copy failed", err);
    } finally {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Button variant="primary" onClick={copy}>
      {copied ? (
        <FiCheck className="h-4 w-4" aria-hidden="true" />
      ) : (
        <FiCopy className="h-4 w-4" aria-hidden="true" />
      )}
      {copied ? copiedLabel : label}
    </Button>
  );
}
