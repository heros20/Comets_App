import { supabase } from "../supabase";

type AdminInfo = {
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
};

type RawRun = {
  admin_id: string | null;
  score: number | null;
  created_at: string | null;
};

type RawProfile = {
  admin_id: string;
  admins: AdminInfo | AdminInfo[] | null;
};

export type CometsRunResult = {
  id: string;
  admin_id: string | null;
  score: number;
  created_at: string | null;
  player_name: string;
};

function normalizeAdmin(admins: AdminInfo | AdminInfo[] | null): AdminInfo | null {
  if (Array.isArray(admins)) return admins[0] ?? null;
  return admins ?? null;
}

function formatPlayerName(admin: AdminInfo | null) {
  const first = admin?.first_name?.trim() || "";
  const last = admin?.last_name?.trim() || "";
  const fullName = `${first} ${last}`.trim();
  return fullName || "Joueur du club";
}

export async function fetchRecentCometsRunResults(limit = 8): Promise<CometsRunResult[]> {
  const { data: runs, error: runsError } = await supabase
    .from("game_runs")
    .select("admin_id, score, created_at")
    .gt("score", 0)
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 3, 18));

  if (runsError) throw runsError;

  const recentUniqueRuns: RawRun[] = [];
  const seenPlayers = new Set<string>();

  for (const raw of (runs ?? []) as RawRun[]) {
    const score = Math.max(0, Math.floor(Number(raw.score ?? 0)));
    if (!score) continue;

    const adminKey = String(raw.admin_id ?? "").trim();
    const dedupeKey = adminKey || `anon-${raw.created_at ?? recentUniqueRuns.length}`;
    if (seenPlayers.has(dedupeKey)) continue;

    seenPlayers.add(dedupeKey);
    recentUniqueRuns.push({
      admin_id: adminKey || null,
      score,
      created_at: raw.created_at ?? null,
    });

    if (recentUniqueRuns.length >= limit) break;
  }

  const adminIds = Array.from(
    new Set(
      recentUniqueRuns
        .map((item) => item.admin_id)
        .filter((value): value is string => !!value),
    ),
  );

  const profilesByAdmin = new Map<string, AdminInfo | null>();
  if (adminIds.length > 0) {
    const { data: profiles } = await supabase
      .from("game_profiles")
      .select("admin_id, admins(first_name,last_name,email)")
      .in("admin_id", adminIds);

    for (const raw of (profiles ?? []) as RawProfile[]) {
      profilesByAdmin.set(raw.admin_id, normalizeAdmin(raw.admins));
    }
  }

  return recentUniqueRuns.map((run) => ({
    id: `${run.admin_id ?? "anon"}-${run.created_at ?? "recent"}-${run.score}`,
    admin_id: run.admin_id,
    score: run.score ?? 0,
    created_at: run.created_at,
    player_name: formatPlayerName(run.admin_id ? (profilesByAdmin.get(run.admin_id) ?? null) : null),
  }));
}
