// Pictures staged for a message (#2133), shared by the chat box and 新想法 (#2182): checked,
// shrunk to what Cloud takes, shown as thumbnails until sent.

import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { FiX } from "react-icons/fi";
import type { ChatImage } from "../api";
import type { Copy } from "../i18n";
import { ImagePreview } from "./image-preview";

type ImageCopy = Pick<Copy["ai"], "notImage" | "tooBig" | "tooMany" | "openImage" | "removeImage">;

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 2000;
/** A picture larger than this, drawn again, goes as a JPEG: four must fit Cloud's 4 MB. */
const JPEG_OVER = 1024 * 1024;
const EXT: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };

export type Staged = { id: string; image: ChatImage; url: string };

const base64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** A picture as it is sent: its long side at most MAX_SIDE, a large one as a JPEG. */
async function prepare(file: File): Promise<ChatImage> {
  const name = file.name || `image${EXT[file.type] ?? ".png"}`;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= JPEG_OVER) return { name, type: file.type, content: await base64(file) };
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const g = canvas.getContext("2d")!;
  const draw = (type: string, quality?: number) =>
    new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), type, quality));
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let type = file.type === "image/gif" ? "image/png" : file.type;
  let blob = await draw(type);
  if (blob.size > JPEG_OVER && type !== "image/jpeg") {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    type = "image/jpeg";
  }
  if (blob.size > JPEG_OVER) blob = await draw(type, 0.85);
  const renamed = type === file.type ? name : name.replace(/\.[^.]*$/, "") + EXT[type];
  return { name: renamed, type, content: await base64(blob) };
}

/** The staged pictures; `onProblem` hears why one was refused, and null as a new batch starts. */
export function useStagedImages(c: ImageCopy, onProblem: (problem: string | null) => void) {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [dragging, setDragging] = useState(false);
  /** Pictures staged or on their way there: a second drop counts the first's. */
  const held = useRef(0);

  const add = async (files: File[]) => {
    onProblem(null);
    for (const file of files) {
      if (!IMAGE_TYPES.includes(file.type)) {
        onProblem(c.notImage(file.name));
        continue;
      }
      if (file.size > MAX_BYTES) {
        onProblem(c.tooBig(file.name));
        continue;
      }
      if (held.current >= MAX_IMAGES) {
        onProblem(c.tooMany);
        break;
      }
      held.current++;
      const image = await prepare(file).catch(() => null);
      if (!image) {
        held.current--;
        onProblem(c.notImage(file.name));
        continue;
      }
      setStaged((s) => [...s, { id: crypto.randomUUID(), image, url: `data:${image.type};base64,${image.content}` }]);
    }
  };
  const remove = (id: string) => {
    held.current--;
    setStaged((all) => all.filter((x) => x.id !== id));
  };
  const clear = () => {
    setStaged([]);
    held.current = 0;
  };
  /** Spread on what takes a drop: `dragging` is on while files are over it. */
  const drop = {
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: (e: DragEvent) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragging(false),
    onDrop: (e: DragEvent) => {
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      setDragging(false);
      void add([...e.dataTransfer.files]);
    },
  };
  /** A paste's pictures, taken in place of the text it would have put in. */
  const paste = (e: ClipboardEvent) => {
    const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    e.preventDefault();
    void add(files);
  };
  return { staged, images: staged.map((s) => s.image), dragging, add, remove, clear, drop, paste };
}

/** The staged pictures as thumbnails: one opens large, its corner takes it out. */
export function StagedThumbs({ c, staged, onRemove, className }: { c: ImageCopy; staged: Staged[]; onRemove: (id: string) => void; className?: string }) {
  const [viewing, setViewing] = useState<Staged | null>(null);
  if (!staged.length) return null;
  return (
    <div className={className ?? "flex flex-wrap items-center gap-2"}>
      {staged.map((s) => (
        <span key={s.id} className="relative block">
          <button type="button" onClick={() => setViewing(s)} aria-label={c.openImage} title={c.openImage} className="block cursor-pointer rounded-[8px]">
            <img src={s.url} alt={s.image.name} className="size-[44px] rounded-[8px] object-cover shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)]" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(s.id)}
            aria-label={c.removeImage}
            title={c.removeImage}
            className="absolute -right-[5px] -top-[5px] grid size-[16px] cursor-pointer place-items-center rounded-full border-[1.5px] border-nb-paper bg-nb-ink text-nb-cream"
          >
            <FiX size={9} aria-hidden />
          </button>
        </span>
      ))}
      {viewing && <ImagePreview src={viewing.url} alt={viewing.image.name} onClose={() => setViewing(null)} />}
    </div>
  );
}
