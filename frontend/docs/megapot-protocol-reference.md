# Megapot Protocol Reference

Source: Megapot docs — Build on the Protocol → Protocol Reference.
ABIs are served live, CORS-open, at `https://llms.megapot.io/abi/<Name>.json` and `.txt`. Fetch them at build or runtime — do not vendor ABIs into the repo, they go stale.

Everything Megapot does runs through one contract: `Jackpot`. The other contracts are either tokens it mints, the pool it draws from, or thin helpers that route a purchase into it.

## Addresses (Base, chain 8453)

| Contract | Address |
|---|---|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Jackpot | `0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2` |
| JackpotTicketNFT | `0x48FfE35AbB9f4780a4f1775C2Ce1c46185b366e4` |
| JackpotLPManager | `0xE63E54DF82d894396B885CE498F828f2454d9dCf` |
| GuaranteedMinimumPayoutCalculator | `0x97a22361b6208aC8cd9afaea09D20feC47046CBD` |
| BatchPurchaseFacilitator | `0xBA343479D98a1Ed333899999D95a7343B808a76F` |
| JackpotAutoSubscription | `0x2694Bd48f3e6B4775943067DC842C93bf5F19DcD` |
| JackpotRandomTicketBuyer | `0xb9560b43b91dE2c1DaF5dfbb76b2CFcDaFc13aBd` |
| TicketAutoCompoundVault | `0xfa6a75366E0A9dF56d67E4B4141050b438DB2A5E` |

`JackpotBridgeManager` and `ScaledEntropyProvider` are protocol internals — not called directly.

## Purchase signatures

All five purchase routes carry a trailing `bytes32 _source` telemetry tag, plus two claim calls.

```solidity
// Up to 10 custom-number tickets, minted immediately.
Jackpot.buyTickets(
    Ticket[] _tickets,
    address _recipient,
    address[] _referrers,
    uint256[] _referralSplit,
    bytes32 _source
) returns (uint256[] ticketIds);

// Random / quick-pick, minted immediately.
JackpotRandomTicketBuyer.buyTickets(
    uint256 _count,
    address _recipient,
    address[] _referrers,
    uint256[] _referralSplit,
    bytes32 _source
);

// More than 10 tickets, keeper-executed.
BatchPurchaseFacilitator.createBatchOrder(
    address _recipient,
    uint256 _dynamicCount,
    Ticket[] _staticTickets,
    address[] _referrers,
    uint256[] _referralSplit,
    bytes32 _source
);

// Recurring across drawings, keeper-executed.
JackpotAutoSubscription.createSubscription(
    address _recipient,
    uint256 _days,
    uint256 _dynamicPerDay,
    Ticket[] _staticTickets,
    address[] _referrers,
    uint256[] _referralSplit,
    bytes32 _source
);

// Claim winnings + re-buy in one tx.
TicketAutoCompoundVault.depositAndCompound(
    uint256[] _ticketIds,
    address[] _referrers,
    uint256[] _referralSplit,
    bytes32 _source
);

// Claims.
Jackpot.claimWinnings(uint256[] _ticketIds);
Jackpot.claimReferralFees();
```

Confirm exact parameter types against the live ABI at `llms.megapot.io/abi` before encoding a call. Before any purchase, approve USDC to the contract that receives payment (the contract you are calling).

## Key concepts

### Ticket struct

```solidity
struct Ticket {
    uint8[] normals;  // 5 unique numbers in [1, ballMax]
    uint8 bonusball;  // 1 number in [1, bonusballMax]
}
```

`normals` is 5 unique numbers; ordering not required. Read `ballMax` / `bonusballMax` from `Jackpot.getDrawingState()` per drawing — do not hardcode.

### DrawingState (`Jackpot.getDrawingState(_drawingId)`)

| Field | Meaning |
|---|---|
| `prizePool` | Total prize available for the drawing |
| `ticketPrice` | Cost per ticket, USDC (6 decimals) |
| `referralFee` | Fraction of ticket price paid to referrers (1e18 precision) |
| `referralWinShare` | Fraction of winnings shared with referrers (1e18 precision) |
| `globalTicketsBought` | Total tickets sold this drawing |
| `drawingTime` | Unix timestamp when the drawing executes |
| `ballMax` | Max normal-ball number for this drawing |
| `bonusballMax` | Max bonusball for this drawing |
| `jackpotLock` | true while a drawing is in progress |

Read live referral rates from `referralFee` / `referralWinShare` rather than assuming a fixed percentage.

### Prize tiers

Matches map to tier `0..11` via `matchedNormals * 2 + (bonusballMatch ? 1 : 0)`. Tier 0 = no match, tier 11 = jackpot (5 normals + bonusball). Tiers 0 and 2 never pay out.

Payout amounts are per-drawing, not protocol constants — premium weights and guaranteed minimums are owner-settable on `GuaranteedMinimumPayoutCalculator`, snapshotted when each drawing opens.

- **UI / active or settled round:** Data API — `Round.prize_tiers` on `GET /v1/rounds/active` or `/v1/rounds/{id}`.
- **Straight from chain:** `getExpectedDrawingTierPayouts` (drawing in flight), `getDrawingTierPayouts` (settled), `getDrawingTierInfo(drawingId)` (weights/minimums).

Note: `getExpectedDrawingTierPayouts` ignores its args and returns stored settled payouts once `_drawingId < currentDrawingId`, and returns all zeros during the rollover window before settlement writes them.

## Which contract do I call?

`Jackpot` is the main entry point — integrate this one if you integrate only one.

| Contract | Use it when you need to |
|---|---|
| Jackpot | Buy up to 10 custom-number tickets, claim winnings, claim referral fees, deposit/withdraw as LP |
| JackpotRandomTicketBuyer | Buy quick-pick tickets, numbers chosen on-chain |
| BatchPurchaseFacilitator | Buy more than 10 tickets in a single drawing |
| JackpotAutoSubscription | Buy tickets automatically across multiple drawings |
| TicketAutoCompoundVault | Claim winnings and re-buy in one transaction |

## Security & audits

Independently audited, operates autonomously — anyone can build on it without permission.

| Auditor | Date | Report |
|---|---|---|
| Zellic | Oct 2025 | see docs |
| Code4rena | Nov 2025 | see docs |
| Independent Auditors | Dec 2025 | see docs |

ABIs and contract artifacts: `github.com/coordinationlabs/megapot-v2-public`. Vulnerabilities: `security@megapot.io`.
