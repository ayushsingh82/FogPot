# FogPot

**A hidden boss. A shared jackpot. Every hit is a secret until the fog lifts.**

FogPot is a confidential boss-raid game built for the **Inco Summer Game Jam**. A shared boss lives onchain with its HP and weak point fully encrypted — nobody, not the players, not the contract deployer, not anyone watching the chain, can read them. Players pay a small USDC fee to land a blind attack, hoping to guess the hidden weak point for a critical hit. When the boss falls, every fee ever paid in gets batch-converted into real [Megapot](https://megapot.io) jackpot tickets, split across raiders by the damage they dealt.

It's a raid boss, a slot machine, and a lottery pool, wired together through confidential compute.

---

## How it works

1. **Sign in once, attack freely.** Connect a wallet and authorize a throwaway session key with a single signature. Every attack after that is signed by the session key locally — no MetaMask popup per hit.
2. **Attack blind.** Pay 0.01 USDC and submit an encrypted guess at the boss's hidden weak point. Guess right for a critical hit, guess wrong for normal damage — only you can ever decrypt which one you got.
3. **The fog lifts in bits, not numbers.** Boss HP and its weak point stay encrypted onchain via [Inco Lightning](https://docs.inco.org). The public only ever learns single-bit milestones — HP crossed 75% / 50% / 25% / defeated — never the exact HP or the damage that caused it.
4. **The pool pays out.** When the boss falls, every USDC paid in gets batch-converted into real Megapot tickets via `BatchPurchaseFacilitator`, split by damage contribution.

No mocked reward, no simulated payout, no link-out — boss defeat triggers a live ticket purchase on Base.

## Why it's confidential

Most onchain "hidden information" games fake it — the state is public, only the UI hides it. FogPot's boss HP, weak point, and per-player damage are genuinely encrypted contract state:

- **Encrypted HP & weak point** — stored as `euint256`/`ebool` via Inco Lightning. Attacks compare an encrypted guess against the encrypted weak point (`e.eq`) and compute crit-vs-normal damage (`e.select`) without ever decrypting either.
- **Private per-player damage** — each raider's cumulative damage is a private `euint256` that only that raider is ever granted access to decrypt (`allow(msg.sender)`). Nobody else — not other raiders, not the deployer — can see who's dealing how much.
- **One-bit threshold reveals** — going public with "HP crossed 25%" is a genuinely async operation: the contract requests a decryption of a single boolean (`e.reveal`), and a covalidator-signed attestation later settles it (`settleThreshold` + `e.verifyDecryption`). Nothing about exact HP or exact damage is ever exposed.
- **One shared pool** — every attack fee across every raider joins a single USDC pool. You're not grinding solo; the whole raid party wins together when the boss falls.

## Multiplayer

FogPot is one shared boss, not per-player instances — everyone who opens `/raid` is fighting the same fight. The frontend polls a shared boss state every 1.5s, so two browsers (or two thousand) watch the same HP bar drop in real time and show up on the same damage leaderboard. This shared state currently lives in the Next.js server (see [Status](#status) below on what that means for production).

## Session keys

Signing every single attack with your main wallet would mean a MetaMask popup per hit — real friction for a game meant to be played fast. Instead:

1. Your wallet signs **one** off-chain message authorizing a locally-generated burner key for the next hour.
2. That burner key signs every subsequent attack itself, entirely client-side — no further popups.
3. The server verifies both signatures on every attack: that your wallet really authorized this burner key (`recoverMessageAddress` against the authorization message), and that this specific attack was really signed by that key — plus a nonce check to reject replayed signatures.

This is a lightweight alternative to full ERC-4337 account abstraction: no bundler, no paymaster, no smart-contract wallet — just a locally-held keypair and two verified signatures. See [`lib/sessionKey.ts`](frontend/app/lib/sessionKey.ts) and [`api/boss/attack/route.ts`](frontend/app/api/boss/attack/route.ts).

## Sound

Hit, crit, and boss-defeat effects are synthesized in-browser with the Web Audio API (a pitch sweep + filtered noise burst for the "swing and thwack" of a hit, a bigger version plus a stinger for crits, a four-note fanfare for defeat) — no external audio files. Mute state persists in `localStorage`; toggle it from the speaker icon in the navbar.

## Tech stack

| Layer | Tech |
|---|---|
| Confidential compute | [Inco Lightning](https://docs.inco.org) — encrypted onchain state (`euint256`/`ebool`), async attested reveals |
| Jackpot payout | [Megapot](https://megapot.io) — real USDC → jackpot tickets via `BatchPurchaseFacilitator` |
| Settlement | [Base](https://base.org) / [Base Sepolia](https://docs.base.org/tools/network-faucets) — fast, cheap L2 settlement |
| Contracts | Solidity ^0.8.29, [Foundry](https://book.getfoundry.sh) |
| Frontend | Next.js 14 (App Router), React 18, TypeScript, [viem](https://viem.sh) |
| Deploy tooling | [`@inco/js`](https://docs.inco.org) for off-chain ciphertext generation, `tsx` |

## The contract

[`FogPot.sol`](contracts/src/FogPot.sol) holds:

- `bossHp` and `weakPoint` as encrypted `euint256` state, set once at deploy from ciphertexts generated off-chain.
- `attack(bytes guessCiphertext)` — takes the 0.01 USDC fee, compares an encrypted guess against the encrypted weak point (`e.eq`), and updates HP and each player's private damage total homomorphically. Nothing about the outcome is ever made public.
- `settleThreshold(bool crossed, bytes[] sigs)` — applies a covalidator-signed attestation to advance the public HP bucket (75% → 50% → 25% → defeated), one bit at a time.
- `_defeatBoss()` — once HP hits zero, pooled fees are approved and routed into `BatchPurchaseFacilitator.createBatchOrder(...)`, buying real Megapot tickets for the contract. (Per-attacker ticket distribution by damage weighting is a follow-up `claim()` once tickets are minted.)

Megapot only publishes **mainnet** (Base, chain 8453) addresses — there's no real Base Sepolia `BatchPurchaseFacilitator` to point at for testing. [`MockBatchPurchaseFacilitator.sol`](contracts/src/mocks/MockBatchPurchaseFacilitator.sol) is a testnet-only stand-in with the same interface that emits an event instead of buying real tickets; swap in the real mainnet address before going live.

See [`frontend/docs/inco-confidentialdeck-kit.md`](frontend/docs/inco-confidentialdeck-kit.md) for the underlying Inco primitives and [`frontend/docs/megapot-protocol-reference.md`](frontend/docs/megapot-protocol-reference.md) for Megapot's contract addresses and purchase call signatures.

## Deployed contract

**Base Sepolia**

| Contract | Address |
|---|---|
| [`MockBatchPurchaseFacilitator`](contracts/src/mocks/MockBatchPurchaseFacilitator.sol) | [`0xb143a7a988cb170bd9fdfc5b0418052068a33106`](https://sepolia.basescan.org/address/0xb143a7a988cb170bd9fdfc5b0418052068a33106) |
| `FogPot` | not yet deployed |

`FogPot` itself is blocked on a real environment issue, not a bug in this repo: Inco's two published npm packages are out of sync on Base Sepolia right now. `@inco/js`'s `Lightning.baseSepoliaTestnet()` binds to executor `0x168FDc3A...` (a v2 preview deployment), while every version of `@inco/lightning` up to `1.0.3-rc-7` hardcodes a different, older executor address for `Lib.testnet.sol` — one that doesn't appear anywhere in the JS SDK's own deployment registry. There's currently no matching pair of "Solidity library to import" + "SDK call to encrypt with" available. Deploying `FogPot` is unblocked as soon as Inco publishes a compatible pair (or confirms the right way to pin both sides to the same deployment).

## Getting started

### Frontend

```bash
cd frontend
npm install
npm run dev       # http://localhost:3000
```

Routes:
- `/` — landing page
- `/raid` — the shared raid (connect a wallet, sign once, attack the boss)
- `/fighter` — your fighter profile: rank, damage, crit rate, best hit (persisted per wallet)

Build for production:

```bash
npm run build
npm start
```

### Contracts

```bash
cd contracts
forge build
```

`contracts/.env` needs `BASE_RPC_URL`, `DEPLOYER_ADDRESS`, and `DEPLOYER_PRIVATE_KEY` before deploying. Deploy with:

```bash
tsx script/deploy.ts
```

(`bun run script/deploy.ts` currently hits a module-resolution bug in one of Inco's transitive dependencies — use `tsx`/Node instead.)

## Status

Built during the Inco Summer Game Jam. Two things are genuinely real right now: `FogPot.sol` compiles clean against the real Inco Lightning + OpenZeppelin dependencies, and the `@inco/js` encryption pipeline for its constructor args has been verified against Base Sepolia. What's still simulated: the live `/raid` page attacks a shared boss held in the Next.js server's memory (see [Multiplayer](#multiplayer)), not the deployed contract — real damage rolls, a real shared fight, real signature-verified session keys, but not yet an onchain transaction. Wiring `/raid` to call `attack()` on the deployed contract directly (client-side Inco encryption of each guess, polling `settleThreshold`) is the next step once the contract is live.
