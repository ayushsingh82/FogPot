import { createPublicClient, createWalletClient, custom, http } from "viem";
import { baseSepolia } from "viem/chains";

const RPC_URL = "https://sepolia.base.org";

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

export function getWalletClient(account: `0x${string}`) {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("no injected wallet found");
  return createWalletClient({
    chain: baseSepolia,
    transport: custom(eth),
    account,
  });
}
