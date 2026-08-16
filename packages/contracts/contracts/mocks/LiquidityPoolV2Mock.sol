// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {LiquidityPool} from "../LiquidityPool.sol";

/// @dev Test-only contract proving a `LiquidityPool` proxy can be upgraded
///      without losing storage. Inherits the exact storage layout, so this
///      is a safe upgrade target. Not part of the production contract set.
contract LiquidityPoolV2Mock is LiquidityPool {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _usdc) LiquidityPool(_usdc) {}

    function version() external pure returns (string memory) {
        return "v2-mock";
    }
}
