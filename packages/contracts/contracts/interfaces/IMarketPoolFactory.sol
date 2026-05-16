// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

/// @title IMarketPoolFactory
/// @notice Interface for the per-market liquidity-pool factory.
interface IMarketPoolFactory {
    event PoolCreated(bytes32 indexed marketId, address pool);

    /// @notice Deploy a new MarketLiquidityPool for `marketId`, owned by `bettingCore`.
    function createPool(bytes32 marketId, address bettingCore) external returns (address pool);

    /// @notice Address of the pool created for `marketId`, or zero if none.
    function pools(bytes32 marketId) external view returns (address);
}
