import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import {
  FOGPOT_ADDRESS,
  fogpotAbi,
  incoLightningAbi,
  INCO_LIGHTNING_ADDRESS,
} from "../../../lib/fogpotContract";

const RPC_URL = "https://sepolia.base.org";

// Relays a session-key-signed attack onchain via FogPot.attackFor(), so a player
// only ever signs one wallet popup (the SessionAuth authorization) — every attack
// after that is this route submitting a fresh burner-key-signed call. USDC still
// moves out of the player's own balance via their pre-existing allowance to FogPot;
// this relayer never custodies funds, it only fronts gas + the Inco protocol fee,
// same sponsorship model as /api/settle.
export async function POST(req: Request) {
  const relayerKey = process.env.RELAYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!relayerKey) {
    return NextResponse.json({ error: "relayer not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const { player, guessCiphertext, sessionKey, expiresAtSec, authSignature, nonce, attackSignature } =
    body ?? {};
  if (
    !player ||
    !guessCiphertext ||
    !sessionKey ||
    expiresAtSec === undefined ||
    !authSignature ||
    nonce === undefined ||
    !attackSignature
  ) {
    return NextResponse.json({ error: "incomplete attack request" }, { status: 400 });
  }

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
  const account = privateKeyToAccount(relayerKey);
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL) });

  try {
    const fee = await publicClient.readContract({
      address: INCO_LIGHTNING_ADDRESS,
      abi: incoLightningAbi,
      functionName: "getFee",
    });

    const hash = await walletClient.writeContract({
      address: FOGPOT_ADDRESS,
      abi: fogpotAbi,
      functionName: "attackFor",
      args: [
        player,
        guessCiphertext,
        sessionKey,
        BigInt(expiresAtSec),
        authSignature,
        BigInt(nonce),
        attackSignature,
      ],
      value: fee,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return NextResponse.json({ ok: true, hash });
  } catch (err: any) {
    // Surface contract revert reasons (bad nonce, expired session, bad signature, ...)
    // so the frontend can decide whether to restart the session or just retry.
    return NextResponse.json(
      { error: err?.shortMessage ?? err?.message ?? "relay failed" },
      { status: 500 }
    );
  }
}
