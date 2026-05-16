// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

/// @title IBettingCore
/// @notice Minimal external surface of the BettingCore contract.
interface IBettingCore {
    enum BetStatus {
        Pending,
        Won,
        Lost,
        Cancelled,
        Cashed
    }

    enum MarketStatus {
        Open,
        Suspended,
        Settled,
        Cancelled
    }

    /// @notice Place a bet on `marketId`'s `outcome` at `oddsX1000` odds.
    function placeBet(
        bytes32 marketId,
        uint8 outcome,
        uint256 amount,
        uint256 oddsX1000,
        uint256 minOddsX1000
    ) external returns (bytes32 betId);

    /// @notice Claim winnings on a Won bet.
    function claimWinnings(bytes32 betId) external;

    /// @notice Claim refund on a Cancelled market's bet.
    function claimRefund(bytes32 betId) external;
}
