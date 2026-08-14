// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @notice Testnet stand-in for Megapot's BatchPurchaseFacilitator. Megapot only
/// publishes mainnet (Base, chain 8453) addresses — there's no real Base Sepolia
/// deployment to point FogPot at. Mirrors the mainnet interface so FogPot's
/// _defeatBoss() call succeeds on testnet; does not buy real tickets.
/// Swap for the real mainnet address (0xBA343479D98a1Ed333899999D95a7343B808a76F)
/// before going live.
contract MockBatchPurchaseFacilitator {
    struct Ticket {
        uint8[] normals;
        uint8 bonusball;
    }

    event MockBatchOrderCreated(
        address indexed recipient,
        uint256 dynamicCount,
        uint256 staticTicketCount,
        bytes32 source
    );

    function createBatchOrder(
        address _recipient,
        uint256 _dynamicCount,
        Ticket[] calldata _staticTickets,
        address[] calldata /* _referrers */,
        uint256[] calldata /* _referralSplit */,
        bytes32 _source
    ) external {
        emit MockBatchOrderCreated(_recipient, _dynamicCount, _staticTickets.length, _source);
    }
}
