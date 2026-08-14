export type BossState = {
  hp: number;
  maxHp: number;
  poolUsd: number;
  defeated: boolean;
  damageByAddress: Record<string, number>;
};

const MAX_HP = 10000;
const ATTACK_FEE_USD = 0.01;

function freshState(): BossState {
  return { hp: MAX_HP, maxHp: MAX_HP, poolUsd: 0, defeated: false, damageByAddress: {} };
}

// Survives Next.js dev-mode hot reload, which otherwise re-evaluates this
// module (and would silently reset the boss) on every file save.
const g = globalThis as unknown as { __fogpotBoss?: BossState; __fogpotNonces?: Set<string> };

function getState(): BossState {
  if (!g.__fogpotBoss) g.__fogpotBoss = freshState();
  return g.__fogpotBoss;
}

function getNonces(): Set<string> {
  if (!g.__fogpotNonces) g.__fogpotNonces = new Set();
  return g.__fogpotNonces;
}

/** Rejects a nonce that's already been spent — one signed attack, one hit. */
export function claimNonce(nonce: string): boolean {
  const nonces = getNonces();
  if (nonces.has(nonce)) return false;
  nonces.add(nonce);
  return true;
}

export function readState(): BossState {
  return getState();
}

export function resetBoss(): BossState {
  g.__fogpotBoss = freshState();
  return g.__fogpotBoss;
}

export function applyAttack(address: string): { state: BossState; hit: number; crit: boolean } {
  const state = getState();
  if (state.defeated) return { state, hit: 0, crit: false };

  const hit = Math.floor(Math.random() * 260) + 40;
  const crit = hit > 200;

  state.hp = Math.max(0, state.hp - hit);
  state.poolUsd += ATTACK_FEE_USD;
  state.damageByAddress[address] = (state.damageByAddress[address] ?? 0) + hit;
  if (state.hp === 0) state.defeated = true;

  return { state, hit, crit };
}
