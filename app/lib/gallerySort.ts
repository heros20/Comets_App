type SortableGalleryItem = {
  id?: number | string | null;
  created_at?: string | null;
};

function toTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

function toIdNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function sortGalleryNewest<T extends SortableGalleryItem>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ta = toTimestamp(a.created_at);
    const tb = toTimestamp(b.created_at);

    if (ta !== null && tb !== null) {
      if (tb !== ta) return tb - ta;
      return toIdNumber(b.id) - toIdNumber(a.id);
    }
    if (ta !== null && tb === null) return -1;
    if (ta === null && tb !== null) return 1;
    return toIdNumber(b.id) - toIdNumber(a.id);
  });
}
