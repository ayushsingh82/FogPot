import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { FOGPOT_ADDRESS } from "./fogpotContract";
import { publicClient } from "./viemClients";

const STORAGE_KEY = "fogpot:session-key";
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const CHAIN_ID = 84532; // Base Sepolia

export type Session = {
  privateKey: `0x${string}`;
  sessionAddress: `0x${string}`;
  owner: `0x${string}`;
  expiresAt: number; // ms, for "session expires in..." UI display only
  expiresAtSec: number; // unix seconds — the exact value signed into SessionAuth; send this to attackFor
  authSignature: `0x${string}`;
  nonce: number; // next attackNonce() to submit on-chain
};

// Same EIP-712 domain + struct hashes FogPot.sol verifies onchain in attackFor() —
// keep these in sync with contracts/src/FogPot.sol.
const domain = {
  name: "FogPot",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: FOGPOT_ADDRESS,
} as const;

const sessionAuthTypes = {
  SessionAuth: [
    { name: "owner", type: "address" },
    { name: "sessionKey", type: "address" },
    { name: "expiresAt", type: "uint256" },
  ],
} as const;

const attackTypes = {
  Attack: [
    { name: "owner", type: "address" },
    { name: "sessionKey", type: "address" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

function sessionAuthTypedData(sessionAddress: `0x${string}`, owner: `0x${string}`, expiresAtSec: bigint) {
  return {
    domain,
    types: sessionAuthTypes,
    primaryType: "SessionAuth" as const,
    message: { owner, sessionKey: sessionAddress, expiresAt: expiresAtSec },
  };
}

function attackTypedData(owner: `0x${string}`, sessionAddress: `0x${string}`, nonce: bigint) {
  return {
    domain,
    types: attackTypes,
    primaryType: "Attack" as const,
    message: { owner, sessionKey: sessionAddress, nonce },
  };
}

export function loadSession(owner: string | null): Session | null {
  if (typeof window === "undefined" || !owner) return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const session: Session = JSON.parse(raw);
    if (session.owner.toLowerCase() !== owner.toLowerCase()) return null;
    if (session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

function persist(session: Session) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
  return session;
}

/// One-time wallet signature: authorizes a fresh burner "session key" to attack on
/// the owner's behalf until it expires. Every attack after this is signed locally
/// by the burner key (signAttack below) — no further wallet popups.
export async function createSession(
  owner: `0x${string}`,
  signTypedData: (typedData: ReturnType<typeof sessionAuthTypedData>) => Promise<string>
): Promise<Session> {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const expiresAtSec = Math.floor(expiresAt / 1000);

  const [authSignature, startNonce] = await Promise.all([
    signTypedData(sessionAuthTypedData(account.address, owner, BigInt(expiresAtSec))),
    publicClient.readContract({
      address: FOGPOT_ADDRESS,
      abi: [
        {
          type: "function",
          name: "attackNonce",
          stateMutability: "view",
          inputs: [{ name: "", type: "address" }],
          outputs: [{ type: "uint256" }],
        },
      ] as const,
      functionName: "attackNonce",
      args: [owner],
    }),
  ]);

  return persist({
    privateKey,
    sessionAddress: account.address,
    owner,
    expiresAt,
    expiresAtSec,
    authSignature: authSignature as `0x${string}`,
    nonce: Number(startNonce),
  });
}

/// Signs the next attack locally with the burner key — instant, no wallet prompt.
export async function signAttack(session: Session): Promise<{ signature: `0x${string}`; nonce: number }> {
  const account = privateKeyToAccount(session.privateKey);
  const signature = await account.signTypedData(
    attackTypedData(session.owner, session.sessionAddress, BigInt(session.nonce))
  );
  return { signature, nonce: session.nonce };
}

/// Call after a relayed attack lands so the next signAttack() uses the right nonce.
export function advanceSessionNonce(session: Session): Session {
  return persist({ ...session, nonce: session.nonce + 1 });
}
