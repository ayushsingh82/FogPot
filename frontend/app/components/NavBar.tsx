"use client";

import Link from "next/link";
import { useWallet } from "./WalletProvider";

export default function NavBar() {
  const { address, connecting, hasProvider, connect } = useWallet();

  return (
    <div className="header">
      <Link href="/" className="logo">
        FOGPOT
      </Link>
      <div className="nav-links">
        <Link href="/raid" className="nav-link">
          RAID
        </Link>
        <button className="connect-btn" onClick={connect} disabled={connecting}>
          {address
            ? `${address.slice(0, 6)}...${address.slice(-4)}`
            : connecting
            ? "CONNECTING..."
            : hasProvider
            ? "CONNECT"
            : "GET METAMASK"}
        </button>
      </div>
    </div>
  );
}
