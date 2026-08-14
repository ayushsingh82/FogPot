// Deploy FogPot to Base Sepolia.
//
// Two testnet-only substitutions vs. mainnet:
//  - USDC: real Base Sepolia USDC (0x036CbD53842c5426634e7929541eC2318f3dCF7e),
//    verified live on-chain (symbol()/decimals() checked via RPC).
//  - Megapot BatchPurchaseFacilitator: Megapot only publishes mainnet (chain 8453)
//    addresses, so we deploy MockBatchPurchaseFacilitator here — same interface,
//    no real ticket purchase. Swap for the real mainnet address before going live.
//
// Run with: bun run script/deploy.ts

import { readFileSync } from "fs";
import { createPublicClient, createWalletClient, http, getContractAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { Lightning } from "@inco/js/lite";

const RPC_URL = process.env.BASE_RPC_URL;
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;

if (!RPC_URL || !PRIVATE_KEY) {
  throw new Error("BASE_RPC_URL and DEPLOYER_PRIVATE_KEY must be set in contracts/.env");
}

const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const MAX_HP = 10000n;
const INITIAL_WEAK_POINT = 1n; // arbitrary index in [0, 3)
const SOURCE = "0x0000000000000000000000000000000000000000000000000000000000000001" as const;

function loadArtifact(path: string) {
  const json = JSON.parse(readFileSync(path, "utf8"));
  return { abi: json.abi, bytecode: json.bytecode.object as Hex };
}

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY!);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL) });

  console.log("Deployer:", account.address);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Balance:", balance, "wei");

  // 1. Deploy the testnet stand-in facilitator.
  const mock = loadArtifact("out/MockBatchPurchaseFacilitator.sol/MockBatchPurchaseFacilitator.json");
  const mockHash = await walletClient.deployContract({ abi: mock.abi, bytecode: mock.bytecode, args: [] });
  const mockReceipt = await publicClient.waitForTransactionReceipt({ hash: mockHash });
  const facilitatorAddress = mockReceipt.contractAddress!;
  console.log("MockBatchPurchaseFacilitator deployed:", facilitatorAddress);

  // 2. Predict FogPot's address so the encrypted constructor args are bound to it
  //    (Inco encryption is scoped to accountAddress + dappAddress).
  const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
  const predictedFogPotAddress = getContractAddress({ from: account.address, nonce: BigInt(nonce) });
  console.log("Predicted FogPot address:", predictedFogPotAddress);

  // 3. Encrypt the initial boss HP and weak point, bound to (deployer, predicted FogPot).
  const lightning = await Lightning.baseSepoliaTestnet();
  const hpCiphertext = await lightning.encrypt(MAX_HP, {
    accountAddress: account.address,
    dappAddress: predictedFogPotAddress,
  });
  const weakPointCiphertext = await lightning.encrypt(INITIAL_WEAK_POINT, {
    accountAddress: account.address,
    dappAddress: predictedFogPotAddress,
  });
  console.log("Encrypted initial HP and weak point.");

  // 4. Deploy FogPot.
  const fogpot = loadArtifact("out/FogPot.sol/FogPot.json");
  const fogpotHash = await walletClient.deployContract({
    abi: fogpot.abi,
    bytecode: fogpot.bytecode,
    args: [USDC_BASE_SEPOLIA, facilitatorAddress, SOURCE, hpCiphertext, weakPointCiphertext],
  });
  const fogpotReceipt = await publicClient.waitForTransactionReceipt({ hash: fogpotHash });
  const fogpotAddress = fogpotReceipt.contractAddress!;

  if (fogpotAddress.toLowerCase() !== predictedFogPotAddress.toLowerCase()) {
    console.warn(
      "WARNING: deployed address != predicted address — encrypted constructor args are bound to the wrong contract. " +
        `predicted=${predictedFogPotAddress} actual=${fogpotAddress}`
    );
  }

  console.log("\nFogPot deployed:", fogpotAddress);
  console.log("USDC:", USDC_BASE_SEPOLIA);
  console.log("MockBatchPurchaseFacilitator:", facilitatorAddress);
  console.log(`\nhttps://sepolia.basescan.org/address/${fogpotAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
