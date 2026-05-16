// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

/// @title IMarketLiquidityPool
/// @notice Interface for a per-market USDC liquidity pool.
interface IMarketLiquidityPool {
    /// @notice LP deposits USDC and receives proportional shares.
    function deposit(uint256 usdcAmount) external returns (uint256 sharesMinted);

    /// @notice Begin the timelocked withdrawal window for the caller.
    function requestWithdrawal() external;

    /// @notice Burn caller's shares and return proportional USDC.
    function executeWithdrawal() external returns (uint256 usdcOut);

    /// @notice Lock liquidity to back a pending bet's potential payout (BettingCore only).
    function lockLiquidity(uint256 amount) external;

    /// @notice Release previously-locked liquidity (BettingCore only).
    function unlockLiquidity(uint256 amount) external;

    /// @notice Settle the pool after a market resolves (BettingCore only).
    /// @param totalBetAmount Sum of all bet amounts that flowed through BettingCore.
    /// @param totalPayoutRequired Sum of payouts owed to winning bettors.
    function settlePool(uint256 totalBetAmount, uint256 totalPayoutRequired) external;

    /// @notice Current share value scaled by 1e18.
    function getShareValue() external view returns (uint256);

    /// @notice Aggregate state for a single LP.
    function getUserPosition(address user)
        external
        view
        returns (uint256 usdcValue, uint256 earnedProfit);

    function usdc() external view returns (address);
    function bettingCore() external view returns (address);
    function marketId() external view returns (bytes32);
    function totalLiquidity() external view returns (uint256);
    function totalShares() external view returns (uint256);
    function lockedForPayouts() external view returns (uint256);
    function settled() external view returns (bool);
}
