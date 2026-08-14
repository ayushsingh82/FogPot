export type FighterStats = {
  totalDamage: number;
  attacks: number;
  crits: number;
  bestHit: number;
};

const EMPTY_STATS: FighterStats = {
  totalDamage: 0,
  attacks: 0,
  crits: 0,
  bestHit: 0,
};

function storageKey(address: string) {
  return `fogpot:fighter:${address.toLowerCase()}`;
}

export function loadFighterStats(address: string | null): FighterStats {
  if (!address || typeof window === "undefined") return EMPTY_STATS;
  try {
    const raw = window.localStorage.getItem(storageKey(address));
    if (!raw) return EMPTY_STATS;
    return { ...EMPTY_STATS, ...JSON.parse(raw) };
  } catch {
    return EMPTY_STATS;
  }
}

export function recordHit(
  address: string,
  damage: number,
  crit: boolean
): FighterStats {
  const prev = loadFighterStats(address);
  const next: FighterStats = {
    totalDamage: prev.totalDamage + damage,
    attacks: prev.attacks + 1,
    crits: prev.crits + (crit ? 1 : 0),
    bestHit: Math.max(prev.bestHit, damage),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey(address), JSON.stringify(next));
  }
  return next;
}

export const RANKS = [
  { min: 10000, title: "BOSS SLAYER" },
  { min: 5000, title: "WEAKPOINT HUNTER" },
  { min: 2000, title: "SHADOW RAIDER" },
  { min: 500, title: "FOG ROOKIE" },
  { min: 0, title: "UNRANKED SCOUT" },
] as const;

export function rankForDamage(totalDamage: number) {
  const idx = RANKS.findIndex((r) => totalDamage >= r.min);
  const current = RANKS[idx];
  const next = idx > 0 ? RANKS[idx - 1] : null;
  const progressPct = next
    ? Math.min(
        100,
        Math.round(
          ((totalDamage - current.min) / (next.min - current.min)) * 100
        )
      )
    : 100;
  return { title: current.title, next, progressPct };
}
