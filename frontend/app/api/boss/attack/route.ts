import { NextResponse } from "next/server";
import { recoverMessageAddress } from "viem";
import { applyAttack, claimNonce } from "../../../lib/bossState";
import { authMessage, attackMessage } from "../../../lib/sessionKey";

const SESSION_TTL_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { address, sessionAddress, expiresAt, authSignature, attackSignature, nonce } =
    body ?? {};

  if (!address || typeof address !== "string") {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  // Session-signed attack: verify the burner key was really authorized by
  // `address`, and that this specific attack was really signed by that key.
  if (sessionAddress || attackSignature) {
    if (!sessionAddress || !expiresAt || !authSignature || !attackSignature || !nonce) {
      return NextResponse.json({ error: "incomplete session attack" }, { status: 400 });
    }
    if (expiresAt < Date.now()) {
      return NextResponse.json({ error: "session expired" }, { status: 401 });
    }
    if (expiresAt - Date.now() > SESSION_TTL_MS + 60_000) {
      return NextResponse.json({ error: "invalid session expiry" }, { status: 401 });
    }
    if (!claimNonce(nonce)) {
      return NextResponse.json({ error: "nonce already used" }, { status: 401 });
    }

    const authRecovered = await recoverMessageAddress({
      message: authMessage(sessionAddress, address, expiresAt),
      signature: authSignature,
    }).catch(() => null);
    if (!authRecovered || authRecovered.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ error: "bad session authorization" }, { status: 401 });
    }

    const attackRecovered = await recoverMessageAddress({
      message: attackMessage(address, nonce),
      signature: attackSignature,
    }).catch(() => null);
    if (!attackRecovered || attackRecovered.toLowerCase() !== sessionAddress.toLowerCase()) {
      return NextResponse.json({ error: "bad attack signature" }, { status: 401 });
    }
  }

  const { state, hit, crit } = applyAttack(address);
  return NextResponse.json({ hit, crit, state });
}
