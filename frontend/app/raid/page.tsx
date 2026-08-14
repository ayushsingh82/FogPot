"use client";

import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import BossSprite from "../components/BossSprite";
import { useWallet } from "../components/WalletProvider";
import { recordHit } from "../lib/fighterStats";
import { playHit, playCrit, playDefeat } from "../lib/sound";
import { useSessionKey } from "../lib/useSessionKey";
import { signAttack } from "../lib/sessionKey";
import type { BossState } from "../lib/bossState";

type LeaderboardEntry = {
  address: string;
  damage: number;
};

const MAX_HP = 10000;
const HP_SEGMENTS = 20;
const POLL_MS = 1500;

const EMPTY_BOSS: BossState = {
  hp: MAX_HP,
  maxHp: MAX_HP,
  poolUsd: 0,
  defeated: false,
  damageByAddress: {},
};

export default function RaidPage() {
  const { address, connecting, hasProvider, connect } = useWallet();
  const { session, starting, error: sessionError, startSession } = useSessionKey();
  const [boss, setBoss] = useState<BossState>(EMPTY_BOSS);
  const [attacking, setAttacking] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [lastCrit, setLastCrit] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [hitPopup, setHitPopup] = useState<{ key: number; value: number; crit: boolean } | null>(
    null
  );
  // Poll the shared boss so every browser watching sees the same fight.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/boss", { cache: "no-store" });
        const state: BossState = await res.json();
        if (!cancelled) setBoss(state);
      } catch {
        // next poll retries
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function attack() {
    if (!address) {
      connect();
      return;
    }
    setAttacking(true);
    setLastResult(null);
    try {
      let activeSession = session;
      if (!activeSession) {
        activeSession = await startSession();
        if (!activeSession) return; // owner declined the one-time authorization
      }

      const { signature, nonce } = await signAttack(activeSession);
      const res = await fetch("/api/boss/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          sessionAddress: activeSession.sessionAddress,
          expiresAt: activeSession.expiresAt,
          authSignature: activeSession.authSignature,
          attackSignature: signature,
          nonce,
        }),
      });
      const { hit, crit, state }: { hit: number; crit: boolean; state: BossState } =
        await res.json();

      setBoss(state);
      setLastCrit(crit);
      setShaking(true);
      setTimeout(() => setShaking(false), 300);
      setHitPopup({ key: Date.now(), value: hit, crit });
      setLastResult(
        crit
          ? `CRITICAL HIT! Weak point found — ${hit} dmg`
          : `You dealt ${hit} damage to the hidden boss.`
      );

      recordHit(address, hit, crit);

      if (state.hp === 0) {
        playDefeat();
      } else if (crit) {
        playCrit();
      } else {
        playHit();
      }
    } finally {
      setAttacking(false);
    }
  }

  const leaderboard: LeaderboardEntry[] = Object.entries(boss.damageByAddress)
    .map(([addr, damage]) => ({ address: addr, damage }))
    .sort((a, b) => b.damage - a.damage);

  const myDamage = address ? boss.damageByAddress[address] ?? 0 : 0;
  const totalDamage = leaderboard.reduce((sum, e) => sum + e.damage, 0) || 1;

  const hpPct = Math.round((boss.hp / boss.maxHp) * 100);
  const filledSegments = Math.round((boss.hp / boss.maxHp) * HP_SEGMENTS);
  const hpState = hpPct > 50 ? "" : hpPct > 20 ? "mid" : "low";

  return (
    <div className="container">
      <NavBar />

      <div className="panel">
        <div className="boss-name">CONFIDENTIAL RAID BOSS</div>
        <div className="boss-title">THE DARK POOL</div>

        <BossSprite shaking={shaking} crit={lastCrit} float={!shaking}>
          {hitPopup && (
            <div key={hitPopup.key} className={`dmg-popup${hitPopup.crit ? " crit" : ""}`}>
              {hitPopup.crit ? "CRIT! " : "+"}
              {hitPopup.value}
            </div>
          )}
        </BossSprite>

        <div className="hp-bar-track">
          {Array.from({ length: HP_SEGMENTS }).map((_, i) => (
            <div
              key={i}
              className={`hp-seg${i < filledSegments ? ` filled ${hpState}` : ""}`}
            />
          ))}
        </div>
        <div className="hp-label">
          <span>{boss.hp.toLocaleString()} / {boss.maxHp.toLocaleString()} HP</span>
          <span>{hpPct}%</span>
        </div>

        <div className="fog-note">
          This boss is shared — every browser hitting ATTACK is fighting the
          same fight in real time. Boss HP + weak points are encrypted
          onchain via Inco Lightning; damage is revealed, the weak point
          isn&apos;t, until HP crosses a threshold.
        </div>

        <div className="grid-2" style={{ marginTop: 20 }}>
          <div>
            <div className="stat-label">YOUR DAMAGE</div>
            <div className="stat-value">{myDamage.toLocaleString()}</div>
          </div>
          <div>
            <div className="stat-label">POOL → TICKETS</div>
            <div className="stat-value">${boss.poolUsd.toFixed(2)}</div>
          </div>
        </div>

        <button className="attack-btn" onClick={attack} disabled={attacking || boss.defeated}>
          {boss.defeated
            ? "BOSS DEFEATED — TICKETS SENT"
            : attacking
            ? starting
              ? "AWAITING SIGNATURE..."
              : "ATTACKING..."
            : address
            ? session
              ? "ATTACK (0.01 USDC)"
              : "SIGN & ATTACK (0.01 USDC)"
            : connecting
            ? "CONNECTING..."
            : hasProvider
            ? "CONNECT TO ATTACK"
            : "GET METAMASK TO ATTACK"}
        </button>

        {address && (
          <div className="hp-label" style={{ marginTop: 10 }}>
            <span>CONNECTED</span>
            <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
          </div>
        )}

        {address && session && (
          <div className="hp-label" style={{ marginTop: 6 }}>
            <span>SESSION</span>
            <span>
              {session.sessionAddress.slice(0, 6)}...{session.sessionAddress.slice(-4)} — no
              more popups this hour
            </span>
          </div>
        )}

        {sessionError && <div className="fog-note">{sessionError}</div>}
        {lastResult && <div className="fog-note">{lastResult}</div>}
      </div>

      <div className="panel">
        <div className="section-title">
          <span className="badge">DAMAGE LEADERBOARD</span>
        </div>
        {leaderboard.length === 0 && (
          <div className="fog-note">No attacks landed yet — connect and swing first.</div>
        )}
        {leaderboard.map((entry, i) => (
          <div className="leaderboard-row" key={entry.address}>
            <span>
              <span className="leaderboard-rank">#{i + 1}</span>
              <span className="leaderboard-addr">
                {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
              </span>
            </span>
            <span className="leaderboard-dmg">{entry.damage.toLocaleString()} dmg</span>
          </div>
        ))}
      </div>

      {boss.defeated && leaderboard.length > 0 && (
        <div className="panel swatch-yellow">
          <div className="section-title">
            <span className="badge">BOSS DEFEATED — PAYOUT PREVIEW</span>
          </div>
          <div className="fog-note">
            ${boss.poolUsd.toFixed(2)} pooled from every attack fee batch-buys real Megapot
            tickets onchain, split across raiders by damage dealt. This is a preview of that
            split — not a real payout yet.
          </div>
          {leaderboard.map((entry, i) => {
            const pct = (entry.damage / totalDamage) * 100;
            const payout = (boss.poolUsd * pct) / 100;
            return (
              <div className="leaderboard-row" key={entry.address}>
                <span>
                  <span className="leaderboard-rank">#{i + 1}</span>
                  <span className="leaderboard-addr">
                    {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                  </span>
                </span>
                <span className="leaderboard-dmg">
                  {pct.toFixed(1)}% · ${payout.toFixed(3)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="footer-note">
        BOSS DEFEAT TRIGGERS A REAL MEGAPOT TICKET BATCH-BUY, SPLIT BY CONTRIBUTION.
      </div>
    </div>
  );
}
