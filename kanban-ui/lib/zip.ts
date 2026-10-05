// A stored (uncompressed) zip: pictures are compressed already, so this is all a download
// of them needs.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zip(files: { name: string; bytes: Uint8Array }[]): Blob {
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  for (const { name, bytes } of files) {
    const path = new TextEncoder().encode(name);
    const crc = crc32(bytes);
    // Version, UTF-8 names, stored, 1 Jan 1980, CRC, sizes, name length, no extra field.
    const fields = (head: DataView, at: number) => {
      head.setUint16(at, 20, true);
      head.setUint16(at + 2, 0x0800, true);
      head.setUint16(at + 4, 0, true);
      head.setUint32(at + 6, 0x00210000, true);
      head.setUint32(at + 10, crc, true);
      head.setUint32(at + 14, bytes.length, true);
      head.setUint32(at + 18, bytes.length, true);
      head.setUint16(at + 22, path.length, true);
    };
    const local = new Uint8Array(30 + path.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    fields(lv, 4);
    local.set(path, 30);
    const entry = new Uint8Array(46 + path.length);
    const cv = new DataView(entry.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    fields(cv, 6);
    cv.setUint32(42, offset, true);
    entry.set(path, 46);
    parts.push(local, new Uint8Array(bytes));
    central.push(entry);
    offset += local.length + bytes.length;
  }
  const size = central.reduce((n, e) => n + e.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, size, true);
  ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}
