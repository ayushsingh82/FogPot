"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "./WalletProvider";

const RULES = [
  "Each attack costs a fixed USDC fee and joins one shared pool.",
  "Every attack is a blind guess at the boss's hidden weak point — hit it for a crit, miss it for normal damage.",
  "Boss HP and its weak point stay encrypted onchain via Inco Lightning. Only your own damage is ever decryptable by you.",
  "The public only learns coarse HP milestones (75% / 50% / 25% / defeated) — never the exact HP or what caused it.",
  "When the boss is defeated, the pooled fees buy a real Megapot ticket batch, split by damage contribution.",
];

export default function NavBar() {
  const { address, connecting, hasProvider, connect } = useWallet();
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div className="header">
      <Link href="/" className="logo">
        FOGPOT
      </Link>
      <div className="nav-links">
        <Link href="/raid" className="nav-link">
          RAID
        </Link>
        <Link href="/fighter" className="nav-link">
          FIGHTER
        </Link>
        <button
          type="button"
          className="nav-rules-btn"
          onClick={() => setRulesOpen(true)}
        >
          RULES
        </button>
        <button
          className="connect-btn nav-connect-btn"
          onClick={connect}
          disabled={connecting}
        >
          {address
            ? `${address.slice(0, 6)}...${address.slice(-4)}`
            : connecting
            ? "CONNECTING..."
            : hasProvider
            ? "CONNECT"
            : "GET METAMASK"}
        </button>
      </div>

      {rulesOpen && (
        <div className="modal-overlay" onClick={() => setRulesOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">HOW THE RAID WORKS</div>
            <ul className="rules-list">
              {RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <button
              type="button"
              className="modal-close"
              onClick={() => setRulesOpen(false)}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
