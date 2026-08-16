"use client";

import { useCallback, useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import BossSprite from "../components/BossSprite";
import { useWallet } from "../components/WalletProvider";
import { playHit, playDefeat } from "../lib/sound";
import { publicClient, getWalletClient } from "../lib/viemClients";
import {
  FOGPOT_ADDRESS,
  USDC_ADDRESS,
  ATTACK_FEE,
  fogpotAbi,
  usdcAbi,
} from "../lib/fogpotContract";
import { encryptGuess, decryptOwnHandle } from "../lib/inco";
import { useSessionKey } from "../lib/useSessionKey";
import { signAttack } from "../lib/sessionKey";

type BossState = {
  hpPct: number;
  defeated: boolean;
  poolUsd: number;
  attackCount: number;
  attackers: string[];
  thresholdCheckPending: boolean;
};

const HP_SEGMENTS = 20;
const POLL_MS = 4000;
const APPROVAL_AMOUNT = ATTACK_FEE * BigInt(1000); // ~1000 attacks before re-approving

const EMPTY_BOSS: BossState = {
  hpPct: 100,
  defeated: false,
  poolUsd: 0,
  attackCount: 0,
  attackers: [],
  thresholdCheckPending: false,
};

export default function RaidPage() {
  const { address, connecting, hasProvider, connect } = useWallet();
  const { session, starting: startingSession, startSession, endSession, bumpNonce } = useSessionKey();
  const [boss, setBoss] = useState<BossState>(EMPTY_BOSS);
  const [attacking, setAttacking] = useState(false);
  const [attackStep, setAttackStep] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [myDamage, setMyDamage] = useState<bigint | null>(null);
  const [revealingDamage, setRevealingDamage] = useState(false);

  const refreshBoss = useCallback(async () => {
    try {
      const [hpPct, defeated, pooledFees, attackers, thresholdCheckPending] = await Promise.all([
        publicClient.readContract({
          address: FOGPOT_ADDRESS,
          abi: fogpotAbi,
          functionName: "revealedHpPct",
        }),
        publicClient.readContract({
          address: FOGPOT_ADDRESS,
          abi: fogpotAbi,
          functionName: "bossDefeated",
        }),
        publicClient.readContract({
          address: FOGPOT_ADDRESS,
          abi: fogpotAbi,
          functionName: "pooledFees",
        }),
        publicClient.readContract({
          address: FOGPOT_ADDRESS,
          abi: fogpotAbi,
          functionName: "getAttackers",
        }),
        publicClient.readContract({
          address: FOGPOT_ADDRESS,
          abi: fogpotAbi,
          functionName: "thresholdCheckPending",
        }),
      ]);
      setBoss({
        hpPct: Number(hpPct),
        defeated,
        poolUsd: Number(pooledFees) / 1e6,
        // Every attack, hit or miss, adds exactly ATTACK_FEE to the pool — so this
        // is an exact count straight off pooledFees, proof attacks are landing
        // even while the coarse HP % looks frozen.
        attackCount: Number(pooledFees / ATTACK_FEE),
        attackers: [...attackers],
        thresholdCheckPending,
      });
      // A threshold reveal is stuck until someone relays a fresh attestation —
      // retry on every poll tick so HP catches up on its own once Inco's
      // decryption oracle network is reachable again, no user action needed.
      if (thresholdCheckPending) {
        fetch("/api/settle", { method: "POST" }).catch(() => {});
      }
    } catch {
      // next poll retries
    }
  }, []);

  // Poll the real onchain boss so every browser watching sees the same fight.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (cancelled) return;
      await refreshBoss();
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshBoss]);

  // Two wallet signatures ever, not one per attack: a one-time USDC approval and a
  // one-time (per hour) session authorization. Every attack after that is signed
  // locally by a burner session key and relayed onchain by the server — the spend
  // still comes out of your own wallet's USDC balance via that approval, you just
  // see it land in your tx history instead of clicking "confirm" each time.
  async function attack() {
    if (!address) {
      connect();
      return;
    }
    setAttacking(true);
    setLastResult(null);
    const player = address as `0x${string}`;
    try {
      const wallet = await getWalletClient(player);

      const allowance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: usdcAbi,
        functionName: "allowance",
        args: [player, FOGPOT_ADDRESS],
      });
      if (allowance < ATTACK_FEE) {
        setAttackStep("Approving USDC (one-time)...");
        const approveHash = await wallet.writeContract({
          address: USDC_ADDRESS,
          abi: usdcAbi,
          functionName: "approve",
          args: [FOGPOT_ADDRESS, APPROVAL_AMOUNT],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      let activeSession = session;
      if (!activeSession) {
        setAttackStep("Authorize a raid session (sign once)...");
        activeSession = await startSession();
        if (!activeSession) throw new Error("Session authorization rejected.");
      }

      setAttackStep("Encrypting your guess...");
      const guess = Math.floor(Math.random() * 3);
      const guessCiphertext = await encryptGuess(player, guess);

      setAttackStep("Relaying attack — no signature needed...");
      const { signature: attackSignature, nonce } = await signAttack(activeSession);

      const res = await fetch("/api/boss/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player,
          guessCiphertext,
          sessionKey: activeSession.sessionAddress,
          expiresAtSec: activeSession.expiresAtSec,
          authSignature: activeSession.authSignature,
          nonce,
          attackSignature,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Attack relay failed.");
      bumpNonce();

      setShaking(true);
      setTimeout(() => setShaking(false), 300);
      playHit();
      setLastResult("Attack landed onchain. Damage is encrypted — reveal it below.");
      setMyDamage(null); // stale until re-revealed

      // A relayer settles the HP threshold server-side — no second signature needed.
      fetch("/api/settle", { method: "POST" })
        .then(() => refreshBoss())
        .catch(() => {});

      await refreshBoss();
      const defeated = await publicClient.readContract({
        address: FOGPOT_ADDRESS,
        abi: fogpotAbi,
        functionName: "bossDefeated",
      });
      if (defeated) playDefeat();
    } catch (err: any) {
      const message = err?.shortMessage || err?.message || "Attack failed.";
      setLastResult(message);
      // A stale/rejected session (expired, bad nonce, revoked) should not keep
      // failing silently — drop it so the next attack starts a fresh one.
      if (/nonce|session|signature/i.test(message)) {
        endSession();
      }
    } finally {
      setAttackStep(null);
      setAttacking(false);
    }
  }

  async function revealMyDamage() {
    if (!address) return;
    setRevealingDamage(true);
    try {
      const player = address as `0x${string}`;
      const handle = await publicClient.readContract({
        address: FOGPOT_ADDRESS,
        abi: fogpotAbi,
        functionName: "damageHandleOf",
        args: [player],
      });
      const wallet = await getWalletClient(player);
      const dmg = await decryptOwnHandle(wallet, handle);
      setMyDamage(dmg);
    } catch (err: any) {
      setLastResult(err?.shortMessage || err?.message || "Could not reveal damage.");
    } finally {
      setRevealingDamage(false);
    }
  }

  const hpPct = boss.hpPct;
  const filledSegments = Math.round((hpPct / 100) * HP_SEGMENTS);
  const hpState = hpPct > 50 ? "" : hpPct > 20 ? "mid" : "low";

  return (
    <div className="container">
      <NavBar />

      <div className="panel">
        <div className="boss-name">CONFIDENTIAL RAID BOSS</div>
        <div className="boss-title">THE DARK POOL</div>

        <BossSprite shaking={shaking} crit={false} float={!shaking} />

        <div className="hp-bar-track">
          {Array.from({ length: HP_SEGMENTS }).map((_, i) => (
            <div
              key={i}
              className={`hp-seg${i < filledSegments ? ` filled ${hpState}` : ""}`}
            />
          ))}
        </div>
        <div className="hp-label">
          <span>{hpPct}% HP (coarse — exact HP stays encrypted)</span>
          <span>{boss.defeated ? "DEFEATED" : "ALIVE"}</span>
        </div>
        <div className="hp-label">
          <span>
            {boss.attackCount} ATTACK{boss.attackCount === 1 ? "" : "S"} LANDED ONCHAIN
          </span>
          <span>POOL ${boss.poolUsd.toFixed(2)}</span>
        </div>

        <div className="fog-note">
          This is the real, deployed FogPot contract on Base Sepolia — every attack
          below is a real onchain transaction. Boss HP + weak points are encrypted via
          Inco Lightning; only coarse thresholds (75/50/25/0%) ever become public.
        </div>

        {boss.thresholdCheckPending && !boss.defeated && (
          <div className="fog-note">
            HP milestone reveal pending — waiting on Inco&apos;s decryption oracle
            network to attest the next threshold. Retrying automatically; this can
            take a moment (or catch up once Inco&apos;s testnet oracles are back if
            they&apos;re temporarily down).
          </div>
        )}

        <div className="grid-2" style={{ marginTop: 20 }}>
          <div>
            <div className="stat-label">YOUR DAMAGE</div>
            <div className="stat-value">
              {myDamage !== null ? myDamage.toLocaleString() : "hidden"}
            </div>
          </div>
          <div>
            <div className="stat-label">POOL → TICKETS</div>
            <div className="stat-value">${boss.poolUsd.toFixed(2)}</div>
          </div>
        </div>

        {address && (
          <button
            type="button"
            className="attack-btn"
            style={{ marginTop: 10 }}
            onClick={revealMyDamage}
            disabled={revealingDamage}
          >
            {revealingDamage ? "REVEALING..." : "REVEAL MY DAMAGE (sign, no gas)"}
          </button>
        )}

        <button
          className="attack-btn"
          style={{ marginTop: 10 }}
          onClick={attack}
          disabled={attacking || boss.defeated || startingSession}
        >
          {boss.defeated
            ? "BOSS DEFEATED"
            : attacking
            ? attackStep ?? "ATTACKING..."
            : address
            ? session
              ? "ATTACK (no signature needed)"
              : "ATTACK (0.01 USDC + start session)"
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
          <div className="hp-label" style={{ marginTop: 4 }}>
            <span>
              SESSION ACTIVE — expires{" "}
              {new Date(session.expiresAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <button
              type="button"
              className="nav-rules-btn"
              onClick={endSession}
              style={{ padding: "2px 8px" }}
            >
              END SESSION
            </button>
          </div>
        )}

        {lastResult && <div className="fog-note">{lastResult}</div>}
      </div>

      <div className="panel">
        <div className="section-title">
          <span className="badge">RAIDERS</span>
        </div>
        <div className="fog-note">
          Damage dealt is encrypted per-player — only you can ever decrypt your own
          total, so this list shows who has attacked, not a damage ranking.
        </div>
        {boss.attackers.length === 0 && (
          <div className="fog-note">No attacks landed yet — connect and swing first.</div>
        )}
        {boss.attackers.map((addr, i) => (
          <div className="leaderboard-row" key={addr}>
            <span>
              <span className="leaderboard-rank">#{i + 1}</span>
              <span className="leaderboard-addr">
                {addr.slice(0, 6)}...{addr.slice(-4)}
              </span>
            </span>
          </div>
        ))}
      </div>

      {boss.defeated && (
        <div className="panel swatch-yellow">
          <div className="section-title">
            <span className="badge">BOSS DEFEATED</span>
          </div>
          <div className="fog-note">
            ${boss.poolUsd.toFixed(2)} pooled from every attack fee batch-bought real
            Megapot tickets onchain. Per-raider ticket distribution by damage weighting
            is a follow-up <code>claim()</code> once tickets are minted — see the README.
          </div>
        </div>
      )}

      <div className="footer-note">
        BOSS DEFEAT TRIGGERS A REAL MEGAPOT TICKET BATCH-BUY, SPLIT BY CONTRIBUTION.
      </div>
    </div>
  );
}
