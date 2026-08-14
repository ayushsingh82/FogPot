"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "../components/NavBar";
import AgentSprite from "../components/AgentSprite";
import { useWallet } from "../components/WalletProvider";
import {
  FighterStats,
  loadFighterStats,
  rankForDamage,
} from "../lib/fighterStats";

const EMPTY_STATS: FighterStats = {
  totalDamage: 0,
  attacks: 0,
  crits: 0,
  bestHit: 0,
};

export default function FighterPage() {
  const { address, connecting, hasProvider, connect } = useWallet();
  const [stats, setStats] = useState<FighterStats>(EMPTY_STATS);

  useEffect(() => {
    setStats(loadFighterStats(address));
  }, [address]);

  const critRate =
    stats.attacks > 0 ? Math.round((stats.crits / stats.attacks) * 100) : 0;
  const { title, next, progressPct } = rankForDamage(stats.totalDamage);

  return (
    <div className="container">
      <NavBar />

      <div className="panel">
        <div className="boss-name">FIGHTER PROFILE</div>
        <div className="boss-title">{title}</div>

        <AgentSprite float size={12} />

        {address ? (
          <>
            <div className="hp-label" style={{ marginTop: 4 }}>
              <span>CALLSIGN</span>
              <span>
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            </div>

            <div className="hp-bar-track" style={{ marginTop: 16 }}>
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className={`hp-seg${
                    i < Math.round((progressPct / 100) * 20) ? " filled" : ""
                  }`}
                />
              ))}
            </div>
            <div className="hp-label">
              <span>
                {next ? `PROGRESS TO ${next.title}` : "MAX RANK REACHED"}
              </span>
              <span>{progressPct}%</span>
            </div>

            <div className="grid-2" style={{ marginTop: 20 }}>
              <div>
                <div className="stat-label">TOTAL DAMAGE</div>
                <div className="stat-value">
                  {stats.totalDamage.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="stat-label">ATTACKS LANDED</div>
                <div className="stat-value">
                  {stats.attacks.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="stat-label">CRIT RATE</div>
                <div className="stat-value">{critRate}%</div>
              </div>
              <div>
                <div className="stat-label">BEST HIT</div>
                <div className="stat-value">
                  {stats.bestHit.toLocaleString()}
                </div>
              </div>
            </div>

            {stats.attacks === 0 && (
              <div className="fog-note">
                No raid history yet. Attack the boss to start building your
                fighter record.
              </div>
            )}
          </>
        ) : (
          <div className="fog-note">
            Connect your wallet to see your fighter record — damage, crit
            rate, and rank are tracked per address.
          </div>
        )}

        <button
          className="attack-btn"
          onClick={address ? undefined : connect}
          disabled={!!address || connecting}
        >
          {address
            ? "CONNECTED"
            : connecting
            ? "CONNECTING..."
            : hasProvider
            ? "CONNECT WALLET"
            : "GET METAMASK"}
        </button>

        <Link
          href="/raid"
          className="attack-btn"
          style={{ display: "block", textAlign: "center", textDecoration: "none" }}
        >
          BACK TO THE RAID
        </Link>
      </div>
    </div>
  );
}
