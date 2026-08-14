"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "./WalletProvider";
import SoundToggle from "./SoundToggle";
import { playClick } from "../lib/sound";

const RULES = [
  {
    icon: "[$]",
    title: "ATTACK COST",
    body: "Each attack costs 0.01 USDC. Nothing is refunded on a miss — every fee, hit or miss, joins one shared pool.",
  },
  {
    icon: "[?]",
    title: "BLIND GUESS",
    body: "Every attack is a guess at the boss's hidden weak point. Guess right for a critical hit, guess wrong for normal damage — only you ever learn which one you got.",
  },
  {
    icon: "[E]",
    title: "ENCRYPTED HP",
    body: "Boss HP and its weak point stay encrypted onchain via Inco Lightning. The public only learns coarse milestones — 75% / 50% / 25% / defeated — never the exact HP or what caused it.",
  },
  {
    icon: "[P]",
    title: "SHARED POOL",
    body: "Every attack fee from every raider piles into one shared USDC pool — win or lose, it never gets refunded, only bigger.",
  },
  {
    icon: "[T]",
    title: "PAYOUT SPLIT",
    body: "When the boss falls, the entire pool batch-buys real Megapot jackpot tickets. Tickets are split across raiders in proportion to the damage each one dealt — the harder you hit, the bigger your cut.",
  },
];

export default function NavBar() {
  const { address, connecting, hasProvider, connect, disconnect } = useWallet();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);

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
          onClick={() => {
            playClick();
            setRulesOpen(true);
          }}
        >
          RULES
        </button>
        <div className="wallet-btn-wrap">
          <button
            className="connect-btn nav-connect-btn"
            onClick={() => (address ? setWalletMenuOpen((v) => !v) : connect())}
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

          {walletMenuOpen && address && (
            <div className="wallet-menu">
              <button
                type="button"
                className="wallet-menu-item"
                onClick={() => {
                  disconnect();
                  setWalletMenuOpen(false);
                }}
              >
                DISCONNECT
              </button>
            </div>
          )}
        </div>
        <SoundToggle />
      </div>

      {rulesOpen && (
        <div className="modal-overlay" onClick={() => setRulesOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">HOW THE RAID WORKS</div>
            <div className="rules-list">
              {RULES.map((rule, i) => (
                <div className="rule-row" key={rule.title}>
                  <div className="rule-icon pixel-font">{rule.icon}</div>
                  <div>
                    <div className="rule-title pixel-font">
                      {i + 1}. {rule.title}
                    </div>
                    <div className="rule-body">{rule.body}</div>
                  </div>
                </div>
              ))}
            </div>
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
