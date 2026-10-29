import { FiAlertCircle } from "react-icons/fi";
import { cn } from "@review/lib/utils";
import * as api from "../api";
import { T } from "../i18n";

export type Trouble = { text: string; upgrade?: boolean } | null;

/** A notice in peach, with 升级到 Pro on the right when `upgrade`. */
export function Notice({ trouble, className }: { trouble: NonNullable<Trouble>; className?: string }) {
  return (
    <p role="status" className={cn("flex items-center gap-2 rounded-[8px] bg-nb-peach-soft px-2.5 py-1.5 text-[12px] leading-snug text-nb-peach-ink", className)}>
      <FiAlertCircle size={13} className="shrink-0" aria-hidden />
      <span className="flex-1">{trouble.text}</span>
      {trouble.upgrade && (
        <a href={api.PRICING_URL} target="_blank" rel="noreferrer" className="shrink-0 font-[700] underline underline-offset-2">
          {T.upgrade}
        </a>
      )}
    </p>
  );
}

const quotaOf = (e: unknown) => (e instanceof api.ApiError && e.code === "quota_exceeded" ? ((e as { quota?: string }).quota ?? "storage") : null);

/** A storage or file size refusal, said without the reader's plan. */
export const quotaText = (e: unknown) => {
  const quota = quotaOf(e);
  return quota ? (quota === "file_size" ? T.quota.file : T.quota.storage) : null;
};

/** The same, worded for the reader's plan; Free is offered Pro. Null for any other refusal. */
export async function quotaTrouble(e: unknown): Promise<Trouble> {
  const quota = quotaOf(e);
  if (!quota) return null;
  const pro = await api.readBilling().then((r) => r.billing.plan === "pro", () => false);
  const file = quota === "file_size";
  return { text: pro ? (file ? T.quota.file : T.quota.storagePro) : file ? T.quota.fileFree : T.quota.storageFree, upgrade: !pro };
}
