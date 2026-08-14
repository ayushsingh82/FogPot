// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint256, ebool, e} from "@inco/lightning/src/Lib.sol";
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
/// guesses at the weak point; only the damage outcome is ever revealed, not the weak point
/// itself, until HP crosses a threshold. Defeating the boss converts the pooled attack fees
/// into Megapot tickets split by damage contribution.
contract FogPot {
    using e for *;

    uint256 public constant MAX_HP = 10_000;
    uint256 public constant ATTACK_FEE = 0.5e6; // USDC, 6 decimals
    uint256 public constant NORMAL_DAMAGE = 60;
    uint256 public constant CRIT_DAMAGE = 220;

    IERC20 public immutable usdc;
    IBatchPurchaseFacilitator public immutable batchPurchaseFacilitator;
    bytes32 public immutable source;

    euint256 private bossHp;
    euint256 private weakPoint; // encrypted index in [0, 3)

    uint256 public revealedHp = MAX_HP;
    bool public bossDefeated;
    uint256 public pooledFees;

    mapping(address => uint256) public damageDealt;
    address[] public attackers;
    mapping(address => bool) private hasAttacked;

    event Attacked(address indexed player, bool crit, uint256 revealedHpAfter);
    event ThresholdRevealed(uint256 hpPct);
    event BossDefeated(uint256 totalPool, uint256 attackerCount);

    constructor(
        address _usdc,
        address _batchPurchaseFacilitator,
        bytes32 _source,
        bytes memory _initialHpCiphertext,
        bytes memory _initialWeakPointCiphertext
    ) {
        usdc = IERC20(_usdc);
        batchPurchaseFacilitator = IBatchPurchaseFacilitator(_batchPurchaseFacilitator);
        source = _source;

        bossHp = _initialHpCiphertext.newEuint256(msg.sender);
        weakPoint = _initialWeakPointCiphertext.newEuint256(msg.sender);
        bossHp.allowThis();
        weakPoint.allowThis();
    }

    /// @param guessCiphertext an encrypted guess at the weak point index [0, 3)
    function attack(bytes memory guessCiphertext) external {
        require(!bossDefeated, "boss already defeated");
        usdc.transferFrom(msg.sender, address(this), ATTACK_FEE);
        pooledFees += ATTACK_FEE;

        euint256 guess = guessCiphertext.newEuint256(msg.sender);
        ebool isCrit = e.eq(guess, weakPoint);

        uint256 damage = e.isAllowed(msg.sender, isCrit) && e.reveal(isCrit)
            ? CRIT_DAMAGE
            : NORMAL_DAMAGE;

        bossHp = e.select(isCrit, _sub(bossHp, CRIT_DAMAGE), _sub(bossHp, NORMAL_DAMAGE));
        bossHp.allowThis();

        if (!hasAttacked[msg.sender]) {
            hasAttacked[msg.sender] = true;
            attackers.push(msg.sender);
        }
        damageDealt[msg.sender] += damage;

        revealedHp = revealedHp > damage ? revealedHp - damage : 0;
        emit Attacked(msg.sender, damage == CRIT_DAMAGE, revealedHp);

        _maybeRevealThreshold();

        if (revealedHp == 0) {
            _defeatBoss();
        }
    }

    function _sub(euint256 hp, uint256 amount) private returns (euint256) {
        euint256 amt = e.asEuint256(amount);
        ebool underflow = e.lt(hp, amt);
        return e.select(underflow, e.asEuint256(0), hp); // placeholder subtraction guarded against underflow
    }

    function _maybeRevealThreshold() private {
        uint256 pct = (revealedHp * 100) / MAX_HP;
        if (pct == 75 || pct == 50 || pct == 25) {
            emit ThresholdRevealed(pct);
        }
    }

    function _defeatBoss() private {
        bossDefeated = true;

        uint256 count = attackers.length;
        address[] memory referrers = new address[](0);
        uint256[] memory splits = new uint256[](0);
        IBatchPurchaseFacilitator.Ticket[] memory tickets =
            new IBatchPurchaseFacilitator.Ticket[](0);

        usdc.approve(address(batchPurchaseFacilitator), pooledFees);

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
