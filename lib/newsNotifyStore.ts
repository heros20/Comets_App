// app/lib/newsNotifyStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const K_NOTIFIED = "NOTIFIED_NEWS_IDS";
const K_READ = "READ_NEWS_IDS";

async function getIds(key: string): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => Number.isFinite(x)).map(Number) : [];
  } catch {
    return [];
  }
}

async function setIds(key: string, ids: number[]) {
  const uniq = Array.from(new Set(ids.filter((x) => Number.isFinite(x)).map(Number)));
  await AsyncStorage.setItem(key, JSON.stringify(uniq));
}

export async function markArticleNotified(articleId?: number | string | null) {
  const id = Number(articleId);
  if (!Number.isFinite(id)) return;
  const notified = await getIds(K_NOTIFIED);
  if (!notified.includes(id)) {
    notified.push(id);
    await setIds(K_NOTIFIED, notified);
  }
}

export async function markArticleRead(articleId?: number | string | null) {
  const id = Number(articleId);
  if (!Number.isFinite(id)) return;
  const read = await getIds(K_READ);
  if (!read.includes(id)) {
    read.push(id);
    await setIds(K_READ, read);
  }
}

export async function getUnreadCount(): Promise<number> {
  const [notified, read] = await Promise.all([getIds(K_NOTIFIED), getIds(K_READ)]);
  const readSet = new Set(read);
  return notified.filter((id) => !readSet.has(id)).length;
}

export async function resetAllNewsBadges() {
  await Promise.all([setIds(K_NOTIFIED, []), setIds(K_READ, [])]);
}

// Optionnels (utile pour auto-clear côté Actus si tu veux)
export async function getNotifiedIds(): Promise<number[]> {
  return getIds(K_NOTIFIED);
}
export async function bulkMarkRead(ids: number[]) {
  if (!ids?.length) return;
  const read = await getIds(K_READ);
  const set = new Set(read);
  let changed = false;
  for (const id of ids) {
    const n = Number(id);
    if (Number.isFinite(n) && !set.has(n)) {
      set.add(n);
      changed = true;
    }
  }
  if (changed) await setIds(K_READ, Array.from(set));
}

// BONUS: export default (au cas où tu l'importerais en default par erreur)
const api = {
  markArticleNotified,
  markArticleRead,
  getUnreadCount,
  resetAllNewsBadges,
  getNotifiedIds,
  bulkMarkRead,
};
export default api;
