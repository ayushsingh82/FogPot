# FogPot

**A hidden boss. A shared jackpot. Every hit is a secret until the fog lifts.**

FogPot is a confidential boss-raid game built for the **Inco Summer Game Jam**. A shared boss lives onchain with its HP and weak point fully encrypted — nobody, not the players, not the contract deployer, not anyone watching the chain, can read them. Players pay a small USDC fee to land a blind attack, hoping to guess the hidden weak point for a critical hit. When the boss falls, every fee ever paid in gets batch-converted into real [Megapot](https://megapot.io) jackpot tickets, split across raiders by the damage they dealt.

It's a raid boss, a slot machine, and a lottery pool, wired together through confidential compute.

---

## How it works

1. **Attack blind.** Pay 0.5 USDC and draw a hidden card from the boss's encrypted deck. You never see the weak point — only the damage you dealt.
2. **The fog lifts gradually.** Boss HP and its weak point stay encrypted onchain via [Inco Lightning](https://docs.inco.org). Hints unlock only as HP crosses 75%, 50%, and 25%.
3. **The pool pays out.** When the boss falls, every USDC paid in gets batch-converted into real Megapot tickets via `BatchPurchaseFacilitator`, split by damage contribution and sent straight to raiders.

No mocked reward, no simulated payout, no link-out — boss defeat triggers a live ticket purchase on Base.

## Why it's confidential

Most onchain "hidden information" games fake it — the state is public, only the UI hides it. FogPot's boss HP and weak point are genuinely encrypted contract state:

- **Encrypted HP & weak point** — stored as `euint256` via Inco Lightning. Nothing about them is readable onchain or off until the game forces a reveal.
- **Fair, unpredictable draws** — damage cards come from an encrypted shuffle. There's no `blockhash` to front-run and no way to predict the next draw before paying for it.
- **One shared pool** — every attack fee across every raider joins a single USDC pool. You're not grinding solo; the whole raid party wins together when the boss falls.

## Tech stack

| Layer | Tech |
|---|---|
| Confidential compute | [Inco Lightning](https://docs.inco.org) — encrypted onchain state (`euint256`), encrypted shuffles, attested reveals |
| Jackpot payout | [Megapot](https://megapot.io) — real USDC → jackpot tickets via `BatchPurchaseFacilitator` |
| Settlement | [Base](https://base.org) — fast, cheap L2 settlement |
| Contracts | Solidity ^0.8.24, [Foundry](https://book.getfoundry.sh) |
| Frontend | Next.js 14 (App Router), React 18, TypeScript, [viem](https://viem.sh) |

## Repo structure

```
fogpot/
├── contracts/                  Foundry project
│   ├── foundry.toml
│   └── src/
│       └── FogPot.sol          Boss raid contract (Inco-encrypted HP/weak point)
├── frontend/                   Next.js app
│   └── app/
│       ├── page.tsx            Landing page
│       ├── raid/page.tsx       The raid — attack the boss, watch HP drop
│       ├── fighter/page.tsx    Per-wallet fighter profile: rank, crit rate, best hit
│       ├── lib/fighterStats.ts Persistent battle-stats store (localStorage, keyed by address)
│       └── components/         Pixel sprites, nav bar, wallet connect
└── docs/
    ├── inco-confidentialdeck-kit.md      Inco Lightning confidential primitives reference
    └── megapot-protocol-reference.md     Megapot contract addresses & purchase signatures
```

## The contract

[`FogPot.sol`](contracts/src/FogPot.sol) holds:

- `bossHp` and `weakPoint` as encrypted `euint256` state, set once at deploy from a ciphertext.
- `attack(bytes guessCiphertext)` — takes the 0.5 USDC fee, compares an encrypted guess against the encrypted weak point (`e.eq`), and only ever reveals whether *this specific attack* was a crit — never the weak point itself.
- Threshold reveals at 75% / 50% / 25% HP, so the fog lifts in stages as the raid progresses.
- `_defeatBoss()` — once HP hits zero, pooled fees are approved and routed into `BatchPurchaseFacilitator.createBatchOrder(...)`, buying real Megapot tickets for the contract. (Per-attacker ticket distribution by `damageDealt` weighting is a follow-up `claim()` once tickets are minted.)

See [`docs/inco-confidentialdeck-kit.md`](docs/inco-confidentialdeck-kit.md) for the underlying Inco primitives (shuffle, draw, deal, reveal, verify) and [`docs/megapot-protocol-reference.md`](docs/megapot-protocol-reference.md) for Megapot's contract addresses and purchase call signatures on Base.

## Getting started

### Frontend

```bash
cd frontend
npm install
npm run dev       # http://localhost:3000
```

Routes:
- `/` — landing page
- `/raid` — the raid itself (connect a wallet, attack the boss)
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

Set `BASE_RPC_URL` in your environment before deploying or running scripts against Base.

## Status

Built during the Inco Summer Game Jam. The frontend raid loop currently runs on mocked attack outcomes for rapid iteration on the game feel; `FogPot.sol` is the target onchain implementation once wired end-to-end with an Inco-encrypted deployment and a live Megapot integration on Base.
