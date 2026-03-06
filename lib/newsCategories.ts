"use client";

export type NewsCategory = "12U" | "15U" | "Seniors";

const ORDER: NewsCategory[] = ["12U", "15U", "Seniors"];

function normalizeKey(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-_]/g, "")
    .toUpperCase();
}

export function normalizeNewsCategory(input?: string | null): NewsCategory | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const key = normalizeKey(raw);
  if (key === "12U") return "12U";
  if (key === "15U") return "15U";
  if (key === "SENIOR" || key === "SENIORS") return "Seniors";
  return null;
}

function uniqueOrdered(list: NewsCategory[]) {
  const seen = new Set<NewsCategory>();
  const out: NewsCategory[] = [];
  ORDER.forEach((cat) => {
    if (list.includes(cat) && !seen.has(cat)) {
      out.push(cat);
      seen.add(cat);
    }
  });
  return out;
}

export function parseNewsCategories(raw?: string | null): NewsCategory[] {
  const source = String(raw ?? "").trim();
  if (!source) return [];

  const tokens = source.split(/[,;|/+&]+/g).map((x) => x.trim()).filter(Boolean);
  if (!tokens.length) {
    const single = normalizeNewsCategory(source);
    return single ? [single] : [];
  }

  const mapped = tokens
    .map((token) => normalizeNewsCategory(token))
    .filter((cat): cat is NewsCategory => !!cat);
  return uniqueOrdered(mapped);
}

export function fallbackCategoriesFromTitle(title?: string | null): NewsCategory[] {
  const key = normalizeKey(String(title ?? ""));
  if (key.startsWith("12U")) return ["12U"];
  if (key.startsWith("15U")) return ["15U"];
  if (key.startsWith("SENIOR") || key.startsWith("SENIORS")) return ["Seniors"];
  return [];
}

export function parseNewsCategoriesWithFallback(raw?: string | null, title?: string | null): NewsCategory[] {
  const parsed = parseNewsCategories(raw);
  if (parsed.length) return parsed;
  return fallbackCategoriesFromTitle(title);
}

export function serializeNewsCategories(categories: NewsCategory[]): string {
  const valid = categories
    .map((cat) => normalizeNewsCategory(cat))
    .filter((cat): cat is NewsCategory => !!cat);
  return uniqueOrdered(valid).join(",");
}

export function newsCategoryIncludes(raw: string | null | undefined, title: string | null | undefined, expected: NewsCategory) {
  return parseNewsCategoriesWithFallback(raw, title).includes(expected);
}
