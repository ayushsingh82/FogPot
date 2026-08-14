// Base Sepolia — see README.md "Deployed contract" for the live addresses.
export const FOGPOT_ADDRESS = "0xf703704ab36dfb9f12201de5eb60c708744bcf2e" as const;
export const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
export const ATTACK_FEE = BigInt(10_000); // 0.01 USDC, 6 decimals

export const fogpotAbi = [
  {
    type: "function",
    name: "attack",
    stateMutability: "payable",
    inputs: [{ name: "guessCiphertext", type: "bytes" }],
    outputs: [],
  },
  {
    type: "function",
    name: "settleThreshold",
    stateMutability: "nonpayable",
    inputs: [
      { name: "crossed", type: "bool" },
      { name: "sigs", type: "bytes[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revealedHpPct",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "bossDefeated",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "pooledFees",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "thresholdCheckPending",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "getAttackers",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "damageHandleOf",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "pendingThresholdCheckHandle",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
] as const;

export const usdcAbi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const incoLightningAbi = [
  {
    type: "function",
    name: "getFee",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

// Lib.testnet.sol's `inco` constant — see contracts/src/FogPot.sol.
export const INCO_LIGHTNING_ADDRESS = "0xe9CB49A5b16C6D4a093E5900AA8b450FD40541B6" as const;
