import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { FOGPOT_ADDRESS, fogpotAbi } from "../../lib/fogpotContract";
import { revealThreshold } from "../../lib/inco";

const RPC_URL = "https://sepolia.base.org";

// Settling a threshold check is permissionless — anyone can pay the gas to advance
// the boss's public HP bucket. Doing it here, server-side with a dedicated relayer
// key, means players never see a second signature prompt for it after every attack.
export async function POST() {
  const relayerKey = process.env.RELAYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!relayerKey) {
    return NextResponse.json({ error: "relayer not configured" }, { status: 500 });
  }

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

  const pending = await publicClient.readContract({
    address: FOGPOT_ADDRESS,
    abi: fogpotAbi,
    functionName: "thresholdCheckPending",
  });
  if (!pending) {
    return NextResponse.json({ settled: false, reason: "nothing pending" });
  }

  const handle = await publicClient.readContract({
    address: FOGPOT_ADDRESS,
    abi: fogpotAbi,
    functionName: "pendingThresholdCheckHandle",
  });
  const { crossed, sigs } = await revealThreshold(handle);

  const account = privateKeyToAccount(relayerKey);
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL) });

  try {
    const hash = await walletClient.writeContract({
      address: FOGPOT_ADDRESS,
      abi: fogpotAbi,
      functionName: "settleThreshold",
      args: [crossed, sigs],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return NextResponse.json({ settled: true, crossed, hash });
  } catch (err: any) {
    // Likely a race with another settle call — the check may already be settled.
    return NextResponse.json({ settled: false, reason: err?.shortMessage ?? "settle failed" });
  }
}
