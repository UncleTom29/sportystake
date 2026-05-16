// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {MarketLiquidityPool} from "./MarketLiquidityPool.sol";
import {IMarketPoolFactory} from "./interfaces/IMarketPoolFactory.sol";

/// @title MarketPoolFactory
/// @notice Deploys one `MarketLiquidityPool` per market.
contract MarketPoolFactory is IMarketPoolFactory, AccessControl {
    /// @notice Role allowed to create pools (BettingCore + operators).
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice USDC token shared by every pool this factory creates.
    address public immutable usdc;

    /// @inheritdoc IMarketPoolFactory
    mapping(bytes32 => address) public override pools;

    error PoolAlreadyExists();
    error InvalidMarketId();
    error InvalidBettingCore();

    /// @param _usdc Address of the USDC token (6 decimals).
    /// @param admin Account granted DEFAULT_ADMIN_ROLE + OPERATOR_ROLE.
    constructor(address _usdc, address admin) {
        usdc = _usdc;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    /// @inheritdoc IMarketPoolFactory
    function createPool(bytes32 marketId, address bettingCore)
        external
        override
        onlyRole(OPERATOR_ROLE)
        returns (address pool)
    {
        if (marketId == bytes32(0)) revert InvalidMarketId();
        if (bettingCore == address(0)) revert InvalidBettingCore();
        if (pools[marketId] != address(0)) revert PoolAlreadyExists();

        pool = address(new MarketLiquidityPool(usdc, bettingCore, marketId));
        pools[marketId] = pool;

        emit PoolCreated(marketId, pool);
    }
}
