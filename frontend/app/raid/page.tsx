"use client";

import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import BossSprite from "../components/BossSprite";
import { useWallet } from "../components/WalletProvider";
import { loadFighterStats, recordHit } from "../lib/fighterStats";
import { playHit, playCrit, playDefeat } from "../lib/sound";

type LeaderboardEntry = {
  address: string;
  damage: number;
};

const MAX_HP = 10000;
const HP_SEGMENTS = 20;
const ATTACK_FEE_USD = 0.01;

export default function RaidPage() {
  const { address, connecting, hasProvider, connect } = useWallet();
  const [hp, setHp] = useState(MAX_HP);
  const [attacking, setAttacking] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [lastCrit, setLastCrit] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [myDamage, setMyDamage] = useState(0);
  const [poolUsd, setPoolUsd] = useState(0);
  const [hitPopup, setHitPopup] = useState<{ key: number; value: number; crit: boolean } | null>(
    null
  );

  useEffect(() => {
    if (!address) return;
    setMyDamage(loadFighterStats(address).totalDamage);
  }, [address]);

  function attack() {
    if (!address) {
      connect();
      return;
    }
    setAttacking(true);
    setLastResult(null);
    setTimeout(() => {
      const hit = Math.floor(Math.random() * 260) + 40;
      const crit = hit > 200;
      const hpAfter = Math.max(0, hp - hit);
      setHp(hpAfter);
      setPoolUsd((prev) => prev + ATTACK_FEE_USD);
      setLastCrit(crit);
      setShaking(true);
      setTimeout(() => setShaking(false), 300);
      setHitPopup({ key: Date.now(), value: hit, crit });
      setLastResult(
        crit
          ? `CRITICAL HIT! Weak point found — ${hit} dmg`
          : `You dealt ${hit} damage to the hidden boss.`
      );
      const stats = recordHit(address, hit, crit);
      setMyDamage(stats.totalDamage);
      setAttacking(false);

      if (hpAfter === 0) {
        playDefeat();
      } else if (crit) {
        playCrit();
      } else {
        playHit();
      }
    }, 500);
  }

  const leaderboard: LeaderboardEntry[] =
    address && myDamage > 0 ? [{ address, damage: myDamage }] : [];

  const hpPct = Math.round((hp / MAX_HP) * 100);
  const filledSegments = Math.round((hp / MAX_HP) * HP_SEGMENTS);
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
          <span>{hp.toLocaleString()} / {MAX_HP.toLocaleString()} HP</span>
          <span>{hpPct}%</span>
        </div>

        <div className="fog-note">
          Boss HP + weak points are encrypted onchain via Inco Lightning.
          Every attack draws a hidden card — damage is revealed, the weak
          point isn&apos;t, until HP crosses a threshold.
        </div>

        <div className="grid-2" style={{ marginTop: 20 }}>
          <div>
            <div className="stat-label">YOUR DAMAGE</div>
            <div className="stat-value">{myDamage.toLocaleString()}</div>
          </div>
          <div>
            <div className="stat-label">POOL → TICKETS</div>
            <div className="stat-value">${poolUsd.toFixed(2)}</div>
          </div>
        </div>

        <button className="attack-btn" onClick={attack} disabled={attacking || hp === 0}>
          {hp === 0
            ? "BOSS DEFEATED — TICKETS SENT"
            : attacking
            ? "ATTACKING..."
            : address
            ? "ATTACK (0.01 USDC)"
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

      <div className="footer-note">
        BOSS DEFEAT TRIGGERS A REAL MEGAPOT TICKET BATCH-BUY, SPLIT BY CONTRIBUTION.
      </div>
    </div>
  );
}
