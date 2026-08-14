// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {euint256, ebool, e, inco} from "@inco/lightning/src/Lib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBatchPurchaseFacilitator {
    struct Ticket {
        uint8[] normals;
        uint8 bonusball;
    }

    function createBatchOrder(
        address _recipient,
        uint256 _dynamicCount,
        Ticket[] calldata _staticTickets,
        address[] calldata _referrers,
        uint256[] calldata _referralSplit,
        bytes32 _source
    ) external;
}

/// @title Fogpot — a confidential boss raid whose defeat funds a Megapot ticket batch-buy.
/// @notice Boss HP and its weak point stay encrypted via Inco Lightning. Attacks are blind
/// guesses at the weak point; damage and crit outcome are only ever decryptable by the
/// attacker themselves, never made public. The only thing the public learns is which
/// coarse HP bucket (75/50/25/0%) the boss has dropped into, one bit at a time.
contract FogPot {
    using e for *;

    uint256 public constant MAX_HP = 10_000;
    uint256 public constant ATTACK_FEE = 0.01e6; // USDC, 6 decimals
    uint256 public constant NORMAL_DAMAGE = 60;
    uint256 public constant CRIT_DAMAGE = 220;

    IERC20 public immutable usdc;
    IBatchPurchaseFacilitator public immutable batchPurchaseFacilitator;
    bytes32 public immutable source;

    euint256 private bossHp;
    euint256 private weakPoint; // encrypted index in [0, 3)
    mapping(address => euint256) private encDamageDealt; // decryptable only by the player themselves

    uint256 public revealedHpPct = 100; // coarse public bucket: 100/75/50/25/0, never exact
    bool public bossDefeated;
    uint256 public pooledFees;

    address[] public attackers;
    mapping(address => bool) private hasAttacked;

    // Threshold reveals are async: attack() requests a decryption of a single "is HP
    // below the next bucket" bit, and settleThreshold() later applies the covalidator's
    // signed attestation. Only one check is ever in flight at a time.
    bool public thresholdCheckPending;
    ebool private pendingThresholdHandle;
    uint256 private pendingThresholdPct;

    event Attacked(address indexed player);
    event ThresholdCheckRequested(uint256 candidatePct);
    event ThresholdRevealed(uint256 hpPct);
    event BossDefeated(uint256 totalPool, uint256 attackerCount);

    constructor(
        address _usdc,
        address _batchPurchaseFacilitator,
        bytes32 _source,
        bytes memory _initialHpCiphertext,
        bytes memory _initialWeakPointCiphertext
    ) payable {
        // newEuint256() below costs the Inco protocol fee, paid from this contract's own
        // balance — it must arrive as msg.value since the constructor has no other funds yet.
        require(msg.value >= 2 * inco.getFee(), "insufficient inco fee");
        usdc = IERC20(_usdc);
        batchPurchaseFacilitator = IBatchPurchaseFacilitator(_batchPurchaseFacilitator);
        source = _source;

        bossHp = _initialHpCiphertext.newEuint256(msg.sender);
        weakPoint = _initialWeakPointCiphertext.newEuint256(msg.sender);
        bossHp.allowThis();
        weakPoint.allowThis();
    }

    /// @param guessCiphertext an encrypted guess at the weak point index [0, 3)
    /// @dev payable: forwards the Inco protocol fee for encrypting `guessCiphertext`.
    function attack(bytes memory guessCiphertext) external payable {
        require(!bossDefeated, "boss already defeated");
        require(msg.value >= inco.getFee(), "insufficient inco fee");
        require(usdc.transferFrom(msg.sender, address(this), ATTACK_FEE), "usdc transferFrom failed");
        pooledFees += ATTACK_FEE;

        euint256 guess = guessCiphertext.newEuint256(msg.sender);
        ebool isCrit = e.eq(guess, weakPoint);
        // Only the attacker can ever learn whether their own guess was a crit.
        isCrit.allow(msg.sender);

        euint256 damage = e.select(isCrit, e.asEuint256(CRIT_DAMAGE), e.asEuint256(NORMAL_DAMAGE));

        bossHp = _sub(bossHp, damage);
        bossHp.allowThis();

        if (!hasAttacked[msg.sender]) {
            hasAttacked[msg.sender] = true;
            attackers.push(msg.sender);
            encDamageDealt[msg.sender] = damage;
        } else {
            encDamageDealt[msg.sender] = e.add(encDamageDealt[msg.sender], damage);
        }
        encDamageDealt[msg.sender].allowThis();
        // Only the attacker can decrypt their own running damage total.
        encDamageDealt[msg.sender].allow(msg.sender);

        emit Attacked(msg.sender);

        _maybeRequestThresholdCheck();
    }

    /// @dev Clamped confidential subtraction: never reveals `hp` or `amount`, and never
    /// underflows the encrypted counter — floors at 0.
    function _sub(euint256 hp, euint256 amount) private returns (euint256) {
        ebool underflow = e.lt(hp, amount);
        euint256 diff = e.sub(hp, amount);
        return e.select(underflow, e.asEuint256(0), diff);
    }

    /// @dev Kicks off an async decryption request for a single bit — "has HP dropped
    /// below the next un-crossed bucket" — never the exact HP or the damage that caused
    /// it. Only one request is ever outstanding; settleThreshold() clears it.
    function _maybeRequestThresholdCheck() private {
        if (thresholdCheckPending || revealedHpPct == 0) return;

        uint256 candidatePct = revealedHpPct - 25;
        ebool check = candidatePct == 0
            ? e.eq(bossHp, e.asEuint256(0))
            : e.lt(bossHp, e.asEuint256((MAX_HP * candidatePct) / 100));
        check.allowThis();
        e.reveal(check);

        pendingThresholdHandle = check;
        pendingThresholdPct = candidatePct;
        thresholdCheckPending = true;
        emit ThresholdCheckRequested(candidatePct);
    }

    /// @notice Applies the covalidator-signed attestation for the outstanding threshold
    /// check. Anyone can relay it once Inco's off-chain decryption is available —
    /// the signatures are what make the value trustworthy, not the caller.
    function settleThreshold(bool crossed, bytes[] calldata sigs) external {
        require(thresholdCheckPending, "no pending check");
        require(e.verifyDecryption(pendingThresholdHandle, crossed, sigs), "bad attestation");

        thresholdCheckPending = false;
        if (!crossed) return; // next attack() will re-request against fresh HP

        uint256 pct = pendingThresholdPct;
        revealedHpPct = pct;
        emit ThresholdRevealed(pct);

        if (pct == 0) {
            _defeatBoss();
        }
    }

    function _defeatBoss() private {
        bossDefeated = true;

        uint256 count = attackers.length;
        address[] memory referrers = new address[](0);
        uint256[] memory splits = new uint256[](0);
        IBatchPurchaseFacilitator.Ticket[] memory tickets =
            new IBatchPurchaseFacilitator.Ticket[](0);

        require(usdc.approve(address(batchPurchaseFacilitator), pooledFees), "usdc approve failed");

        uint256 ticketCount = pooledFees / 1e6; // 1 USDC per ticket, illustrative
        batchPurchaseFacilitator.createBatchOrder(
            address(this),
            ticketCount,
            tickets,
            referrers,
            splits,
            source
        );

        emit BossDefeated(pooledFees, count);
        // Ticket NFT distribution to `attackers` weighted by `damageDealt` happens in a
        // follow-up claim() function once tickets are minted to this contract.
    }
}
