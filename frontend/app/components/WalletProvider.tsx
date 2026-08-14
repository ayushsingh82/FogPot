"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type WalletState = {
  address: string | null;
  connecting: boolean;
  hasProvider: boolean;
  wrongNetwork: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<string>;
};

const WalletContext = createContext<WalletState | null>(null);

const BASE_SEPOLIA_CHAIN_ID = "0x14a34"; // 84532
const BASE_SEPOLIA_PARAMS = {
  chainId: BASE_SEPOLIA_CHAIN_ID,
  chainName: "Base Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://sepolia.base.org"],
  blockExplorerUrls: ["https://sepolia.basescan.org"],
};

function getEthereum(): any {
  if (typeof window === "undefined") return null;
  return (window as any).ethereum ?? null;
}

/// MetaMask keeps whatever network was last selected (e.g. a stray Flare
/// network from another dapp) even after a fresh eth_requestAccounts — it
/// never auto-switches to the chain a dapp actually needs. Force it here so
/// session-key signing and attacks aren't silently signed against the wrong
/// chain.
async function ensureBaseSepolia(eth: any) {
  const currentChainId: string = await eth.request({ method: "eth_chainId" });
  if (currentChainId.toLowerCase() === BASE_SEPOLIA_CHAIN_ID) return;

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_SEPOLIA_CHAIN_ID }],
    });
  } catch (err: any) {
    if (err?.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [BASE_SEPOLIA_PARAMS],
      });
    } else {
      throw err;
    }
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [hasProvider, setHasProvider] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;
    setHasProvider(true);

    eth
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        if (accounts.length > 0) setAddress(accounts[0]);
      })
      .catch(() => {});

    eth
      .request({ method: "eth_chainId" })
      .then((chainId: string) => setWrongNetwork(chainId.toLowerCase() !== BASE_SEPOLIA_CHAIN_ID))
      .catch(() => {});

    const onAccountsChanged = (accounts: string[]) => {
      setAddress(accounts.length > 0 ? accounts[0] : null);
    };
    const onChainChanged = (chainId: string) => {
      setWrongNetwork(chainId.toLowerCase() !== BASE_SEPOLIA_CHAIN_ID);
      window.location.reload();
    };

    eth.on?.("accountsChanged", onAccountsChanged);
    eth.on?.("chainChanged", onChainChanged);

    return () => {
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      window.open("https://metamask.io/download/", "_blank", "noopener,noreferrer");
      return;
    }
    setError(null);
    setConnecting(true);
    try {
      const accounts: string[] = await eth.request({
        method: "eth_requestAccounts",
      });
      await ensureBaseSepolia(eth);
      setWrongNetwork(false);
      setAddress(accounts[0] ?? null);
    } catch (err: any) {
      if (err?.code === 4001) {
        setError("Connection rejected.");
      } else {
        setError("Could not connect wallet.");
      }
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  const signMessage = useCallback(
    async (message: string) => {
      const eth = getEthereum();
      if (!eth || !address) throw new Error("wallet not connected");
      await ensureBaseSepolia(eth);
      return eth.request({
        method: "personal_sign",
        params: [message, address],
      });
    },
    [address]
  );

  return (
    <WalletContext.Provider
      value={{ address, connecting, hasProvider, wrongNetwork, error, connect, disconnect, signMessage }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
