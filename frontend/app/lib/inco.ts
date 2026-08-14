import { Lightning } from "@inco/js/lite";
import { handleTypes } from "@inco/js";
import { toHex } from "viem";
import { FOGPOT_ADDRESS } from "./fogpotContract";
import type { getWalletClient } from "./viemClients";

type ConnectedWalletClient = ReturnType<typeof getWalletClient>;

let lightningPromise: ReturnType<typeof Lightning.baseSepoliaTestnet> | null = null;

function getLightning() {
  if (!lightningPromise) {
    lightningPromise = Lightning.baseSepoliaTestnet();
  }
  return lightningPromise;
}

/// Encrypts a blind guess at the boss's weak point (an index in [0, 3)), bound to
/// (player, FogPot contract) so the ciphertext can only be used in that player's attack.
export async function encryptGuess(account: `0x${string}`, guess: number) {
  const lightning = await getLightning();
  return lightning.encrypt(BigInt(guess), {
    accountAddress: account,
    dappAddress: FOGPOT_ADDRESS,
    handleType: handleTypes.euint256,
  });
}

/// Fetches the covalidator-signed attestation for a publicly-`reveal()`-ed handle
/// (the boss's async HP-threshold check) — no wallet signature needed, it's public.
export async function revealThreshold(handle: `0x${string}`) {
  const lightning = await getLightning();
  const [attestation] = await lightning.attestedReveal([handle]);
  const plaintext = attestation.plaintext as { value: boolean };
  return {
    crossed: plaintext.value,
    sigs: (attestation.covalidatorSignatures as Uint8Array[]).map((sig) => toHex(sig)),
  };
}

/// Decrypts a handle only its owner was ever granted access to (a player's own
/// cumulative damage) — requires the owner's wallet to sign an authorization.
export async function decryptOwnHandle(walletClient: ConnectedWalletClient, handle: `0x${string}`) {
  const lightning = await getLightning();
  // @inco/js bundles its own nested viem, structurally identical to ours but a
  // distinct type identity — cast past the resulting (spurious) type mismatch.
  const [result] = await lightning.attestedDecrypt(walletClient as any, [handle]);
  const plaintext = result.plaintext as { value: bigint };
  return plaintext.value;
}
