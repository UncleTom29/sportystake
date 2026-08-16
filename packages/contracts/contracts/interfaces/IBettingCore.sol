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

    /// @notice A signed, time-boxed assertion that `marketId` is a real
    ///         market closing at `closesAt`. `signature` must recover to an
    ///         ORACLE_SIGNER_ROLE holder over the EIP-712 hash of
    ///         (marketId, closesAt, validUntil). Ignored entirely if the
    ///         market is already registered on-chain.
    struct MarketAttestation {
        bytes32 marketId;
        uint64 closesAt;
        uint64 validUntil;
        bytes signature;
    }

    /// @notice Place a bet on `marketId`'s `outcome` at `oddsX1000` odds.
    function placeBet(
        bytes32 marketId,
        uint8 outcome,
        uint256 amount,
        uint256 oddsX1000,
        uint256 minOddsX1000
    ) external returns (bytes32 betId);

    /// @notice Same as `placeBet`, but registers `attestation.marketId` first
    ///         via its signed oracle attestation if it isn't on-chain yet.
    function placeBetWithAttestation(
        uint8 outcome,
        uint256 amount,
        uint256 oddsX1000,
        uint256 minOddsX1000,
        MarketAttestation calldata attestation
    ) external returns (bytes32 betId);

    /// @notice Claim winnings on a Won bet.
    function claimWinnings(bytes32 betId) external;

    /// @notice Claim refund on a Cancelled market's bet.
    function claimRefund(bytes32 betId) external;

    /// @notice Place a multi-leg bet across distinct markets. Wins only if every leg wins.
    function placeParlayBet(
        bytes32[] calldata marketIds,
        uint8[] calldata outcomes,
        uint256 stake,
        uint256 combinedOddsX1000,
        uint256 minCombinedOddsX1000
    ) external returns (bytes32 parlayId);

    /// @notice Same as `placeParlayBet`, but registers any not-yet-created leg
    ///         markets first via per-leg signed oracle attestations.
    ///         `attestations[i].marketId` must equal `marketIds[i]`.
    function placeParlayBetWithAttestations(
        bytes32[] calldata marketIds,
        uint8[] calldata outcomes,
        uint256 stake,
        uint256 combinedOddsX1000,
        uint256 minCombinedOddsX1000,
        MarketAttestation[] calldata attestations
    ) external returns (bytes32 parlayId);

    /// @notice Claim a parlay where every leg won.
    function claimParlayWinnings(bytes32 parlayId) external;

    /// @notice Claim a refund on a parlay voided by a cancelled leg.
    function claimParlayRefund(bytes32 parlayId) external;
}
