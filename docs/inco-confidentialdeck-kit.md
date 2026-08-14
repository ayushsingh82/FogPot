# The ConfidentialDeck Kit

The five confidential moves behind any hidden-information game.

`ConfidentialDeck` is the base contract you inherit. It wraps the five confidential moves every hidden-card game needs. Everything else in your game is plain Solidity.

Setup, once per file:

```solidity
import {euint256, elist, ETypes, e, inco} from "@inco/lightning/src/Lib.sol";
using e for *;
```

## 1. Shuffle a deck

One Inco op produces the values 1 to n in a secret permutation. No per-card RNG, no bias, no `blockhash` to front-run.

```solidity
elist deck = e.shuffledRange(1, n + 1, ETypes.Uint256); // values 1..n, secret order
e.allow(deck, address(this));                            // keep access across txs (required)
```

Cost: `2 * inco.getEListFee(n, ETypes.Uint256)` (range + shuffle), from contract balance — forward as `msg.value` or pre-fund the contract. Secret: the order. Public: `n` (list length is always public on Inco).

Kit call: `_newShuffledDeck(n)` — does this and resets the draw pointer.

## 2. Draw the next card

Reading a card returns an opaque handle. It does not reveal the value. Disclosure is a separate, deliberate step (moves 3 and 4).

```solidity
euint256 card = e.getEuint256(deck, index); // free; index is a public position
```

Kit call: `_draw()` — returns the next card, advances a public pointer, and calls `allowThis()` for you (load-bearing: `getEuint256` alone gives only this-tx access).

## 3. Deal a card only its owner can see

Private hand or secret role. The `allow` grant is the privacy boundary — only `player` can decrypt it, the contract never emits the value.

```solidity
card.allowThis();   // contract keeps access (needed if revealed later)
card.allow(player); // ONLY this address can decrypt it off-chain
```

A grant is one-way and cannot be revoked — never `allow` a hand to the wrong address.

Kit call: `_dealTo(player)` — draws and does both grants.

Frontend peek (owner signs once): `peekMyCards(zap, walletClient, [handle])` → `attestedDecrypt` under the hood.

## 4. Put a card face-up

Board card or dice roll. Makes the value publicly decryptable forever — irreversible, so reveal only what the rules force open, at the latest safe moment.

```solidity
card.allowThis();
e.reveal(card);
```

Kit call: `_revealCard(card)`, or `_dealFaceUp()` (draw + reveal in one call).

Frontend read (no wallet needed): `readRevealed(zap, handles)` → `attestedReveal` under the hood.

## 5. Settle on a revealed card

At settlement the contract needs the plaintext value on-chain. The frontend brings a covalidator-signed attestation; the contract verifies it against the stored handle, so a signed value for any other card cannot be substituted.

```solidity
// values[i] and sigs[i] come from the frontend
require(e.verifyDecryption(card, value, sigs), "bad attestation");
uint8 id = CardLib.toId(value); // -> rank/suit for a 52-card game
```

Kit call: `_verifyValue(card, value, sigs)` — returns the verified raw value.

Frontend batch for on-chain `settle(...)`:

```ts
const revealed = await readRevealed(zap, handles);
const { values, sigs } = packForSettle(revealed);
await wallet.writeContract({ address, abi, functionName: "settle", args: [values, sigs] });
```

## Adding a new game

1. `contract MyGame is ConfidentialDeck { ... }`.
2. Shuffle with `_newShuffledDeck`. Deal with `_dealTo` (private) or `_dealFaceUp` (public). Read at settlement with `_verifyValue`.
3. Expose the card handles through a view so the frontend can decrypt or reveal them.
4. Add an Ignition module, a deploy script, and a frontend page.

## The three rules that break every new Inco project

- Call `allowThis()` on every stored handle. A handle you cannot re-access is lost forever.
- Pay the fee for `shuffledRange` with `deckFee(n)`, from `msg.value` or a pre-funded contract.
- Never `if` or `require` on an encrypted value, and never `e.reveal` a card before the rules open it.
