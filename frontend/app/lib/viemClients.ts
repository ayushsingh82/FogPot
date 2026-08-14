import { createPublicClient, createWalletClient, custom, http } from "viem";
import { baseSepolia } from "viem/chains";

const RPC_URL = "https://sepolia.base.org";
const BASE_SEPOLIA_CHAIN_ID = "0x14a34"; // 84532
const BASE_SEPOLIA_PARAMS = {
  chainId: BASE_SEPOLIA_CHAIN_ID,
  chainName: "Base Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: ["https://sepolia.basescan.org"],
};

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

/// MetaMask can pin a *different* chain to this specific site than whatever looks
/// active in the wallet's main UI (per-site network memory) — every write here must
/// force Base Sepolia first, or viem's chain guard rejects the transaction.
export async function ensureBaseSepolia(eth: any) {
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

export async function getWalletClient(account: `0x${string}`) {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("no injected wallet found");
  await ensureBaseSepolia(eth);
  return createWalletClient({
    chain: baseSepolia,
    transport: custom(eth),
    account,
  });
}
