import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const STORAGE_KEY = "fogpot:session-key";
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

export type Session = {
  privateKey: `0x${string}`;
  sessionAddress: `0x${string}`;
  owner: string;
  expiresAt: number;
  authSignature: string;
};

// Same message the server reconstructs to verify the owner really
// authorized this burner key — must stay in sync with api/boss/attack.
export function authMessage(sessionAddress: string, owner: string, expiresAt: number) {
  return [
    "FogPot session key authorization",
    "",
    `Owner: ${owner}`,
    `Session key: ${sessionAddress}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
    "",
    "This key can attack the boss on your behalf until it expires.",
    "It cannot move funds or approve spending.",
  ].join("\n");
}

export function attackMessage(owner: string, nonce: string) {
  return `FogPot attack\nowner:${owner}\nnonce:${nonce}`;
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

export async function createSession(
  owner: string,
  signMessage: (message: string) => Promise<string>
): Promise<Session> {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const authSignature = await signMessage(authMessage(account.address, owner, expiresAt));

  const session: Session = {
    privateKey,
    sessionAddress: account.address,
    owner,
    expiresAt,
    authSignature,
  };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function signAttack(session: Session): Promise<{ signature: string; nonce: string }> {
  const account = privateKeyToAccount(session.privateKey);
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const signature = await account.signMessage({ message: attackMessage(session.owner, nonce) });
  return { signature, nonce };
}
