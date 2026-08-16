// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ILiquidityPool
/// @notice Interface for the single, protocol-wide USDC liquidity pool that
///         backs every market on BettingCore.
interface ILiquidityPool {
    /// @notice LP deposits USDC and receives proportional shares.
    function deposit(uint256 usdcAmount) external returns (uint256 sharesMinted);

    /// @notice Begin the timelocked withdrawal window for the caller.
    function requestWithdrawal() external;

    /// @notice Burn caller's shares and return proportional USDC.
    function executeWithdrawal() external returns (uint256 usdcOut);

    /// @notice Lock liquidity to back `marketId`'s pending payout (BettingCore only).
    function lockLiquidity(bytes32 marketId, uint256 amount) external;

    /// @notice Release previously-locked liquidity for `marketId` (BettingCore only).
    function unlockLiquidity(bytes32 marketId, uint256 amount) external;

    /// @notice Reconcile the pool after `marketId` resolves (BettingCore only).
    /// @param totalBetAmount Sum of all bet amounts that flowed through BettingCore for this market.
    /// @param totalPayoutRequired Sum of payouts owed to winning bettors for this market.
    function reportMarketResult(bytes32 marketId, uint256 totalBetAmount, uint256 totalPayoutRequired) external;

    /// @notice Add protocol-funded virtual liquidity (ADMIN only). Real USDC,
    ///         but excluded from LP shares/yield — a non-dilutive capacity
    ///         credit and first-loss buffer.
    function addVirtualLiquidity(uint256 amount) external;

    /// @notice Withdraw previously-added virtual liquidity (ADMIN only).
    function removeVirtualLiquidity(uint256 amount) external;

    /// @notice Current share value scaled by 1e18.
    function getShareValue() external view returns (uint256);

    /// @notice Aggregate state for a single LP.
    function getUserPosition(address user)
        external
        view
        returns (uint256 usdcValue, uint256 earnedProfit);

    /// @notice `totalLiquidity + virtualLiquidity` — the basis for the utilization cap.
    function getEffectiveCapacity() external view returns (uint256);

    /// @notice Currently-locked liquidity attributable to a single market.
    function marketLocked(bytes32 marketId) external view returns (uint256);

    function usdc() external view returns (IERC20);
    function bettingCore() external view returns (address);
    function totalLiquidity() external view returns (uint256);
    function totalShares() external view returns (uint256);
    function lockedForPayouts() external view returns (uint256);
    function virtualLiquidity() external view returns (uint256);
    function getFreeLiquidity(bytes32 settlingMarketId) external view returns (uint256);
}
