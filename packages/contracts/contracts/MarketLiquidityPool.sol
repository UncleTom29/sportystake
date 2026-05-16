// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IMarketLiquidityPool} from "./interfaces/IMarketLiquidityPool.sol";

/// @title MarketLiquidityPool
/// @notice Holds USDC backing payouts for a single market and tracks LP shares.
/// @dev Deployed by `MarketPoolFactory`. Mutating LP-only operations are
///      `nonReentrant`; operations that touch payout liquidity are restricted
///      to the parent `BettingCore` contract.
contract MarketLiquidityPool is IMarketLiquidityPool, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    /// @notice Minimum USDC accepted on a single deposit (10 USDC, 6 decimals).
    uint256 public constant MIN_DEPOSIT = 10e6;

    /// @notice Cooldown between `requestWithdrawal` and `executeWithdrawal`.
    uint256 public constant WITHDRAWAL_TIMELOCK = 48 hours;

    /// @notice Max share (in basis points) of `totalLiquidity` reservable for
    ///         pending payouts at any moment.
    uint256 public constant MAX_POOL_UTILIZATION_BPS = 8000;

    /// @notice Basis-point denominator.
    uint256 private constant BPS_DENOM = 10000;

    // -----------------------------------------------------------------------
    // Immutables / state
    // -----------------------------------------------------------------------

    IERC20 public immutable override usdc;
    address public immutable override bettingCore;
    bytes32 public immutable override marketId;

    uint256 public override totalLiquidity;
    uint256 public override totalShares;
    uint256 public override lockedForPayouts;
    bool public override settled;

    /// @notice Frozen share value at settlement, scaled by 1e18.
    uint256 public settlementShareValueX1e18;

    /// @notice Shares owned by each LP.
    mapping(address => uint256) public shares;

    /// @notice Cumulative USDC each LP has deposited (basis for profit calc).
    mapping(address => uint256) public depositedPrincipal;

    /// @notice Timestamp of pending withdrawal request, 0 if none.
    mapping(address => uint256) public withdrawalRequestTime;

    // -----------------------------------------------------------------------
    // Errors
    // -----------------------------------------------------------------------

    error OnlyBettingCore();
    error DepositTooSmall();
    error PoolAlreadySettled();
    error PoolNotSettled();
    error NoSharesOwned();
    error WithdrawalNotRequested();
    error WithdrawalTimelockActive();
    error InsufficientUnlockedLiquidity();
    error UtilizationCapExceeded();
    error UnlockExceedsLocked();
    error ZeroAmount();

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event Deposited(address indexed lp, uint256 usdcAmount, uint256 sharesMinted);
    event WithdrawalRequested(address indexed lp, uint256 unlockAt);
    event WithdrawalExecuted(address indexed lp, uint256 sharesBurned, uint256 usdcOut);
    event LiquidityLocked(uint256 amount, uint256 totalLocked);
    event LiquidityUnlocked(uint256 amount, uint256 totalLocked);
    event PoolSettled(uint256 totalBetAmount, uint256 totalPayoutRequired, uint256 shareValueX1e18);

    // -----------------------------------------------------------------------
    // Modifiers
    // -----------------------------------------------------------------------

    modifier onlyBettingCore() {
        if (msg.sender != bettingCore) revert OnlyBettingCore();
        _;
    }

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /// @param _usdc USDC token (6 decimals) backing this pool.
    /// @param _bettingCore Address of the controlling BettingCore.
    /// @param _marketId Opaque identifier of the market this pool backs.
    constructor(address _usdc, address _bettingCore, bytes32 _marketId) {
        usdc = IERC20(_usdc);
        bettingCore = _bettingCore;
        marketId = _marketId;
    }

    // -----------------------------------------------------------------------
    // LP entry / exit
    // -----------------------------------------------------------------------

    /// @inheritdoc IMarketLiquidityPool
    function deposit(uint256 usdcAmount)
        external
        override
        nonReentrant
        returns (uint256 sharesMinted)
    {
        if (settled) revert PoolAlreadySettled();
        if (usdcAmount < MIN_DEPOSIT) revert DepositTooSmall();

        // Mint shares proportional to current share value.
        if (totalShares == 0) {
            sharesMinted = usdcAmount;
        } else {
            sharesMinted = (usdcAmount * totalShares) / totalLiquidity;
        }

        shares[msg.sender] += sharesMinted;
        depositedPrincipal[msg.sender] += usdcAmount;
        totalShares += sharesMinted;
        totalLiquidity += usdcAmount;

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        emit Deposited(msg.sender, usdcAmount, sharesMinted);
    }

    /// @inheritdoc IMarketLiquidityPool
    function requestWithdrawal() external override {
        if (shares[msg.sender] == 0) revert NoSharesOwned();
        withdrawalRequestTime[msg.sender] = block.timestamp;
        emit WithdrawalRequested(msg.sender, block.timestamp + WITHDRAWAL_TIMELOCK);
    }

    /// @inheritdoc IMarketLiquidityPool
    function executeWithdrawal()
        external
        override
        nonReentrant
        returns (uint256 usdcOut)
    {
        uint256 userShares = shares[msg.sender];
        if (userShares == 0) revert NoSharesOwned();

        // Post-settlement: timelock is bypassed (the market is final).
        if (!settled) {
            uint256 requestedAt = withdrawalRequestTime[msg.sender];
            if (requestedAt == 0) revert WithdrawalNotRequested();
            if (block.timestamp < requestedAt + WITHDRAWAL_TIMELOCK) {
                revert WithdrawalTimelockActive();
            }
        }

        uint256 shareValue = settled ? settlementShareValueX1e18 : getShareValue();
        usdcOut = (userShares * shareValue) / 1e18;

        // Pre-settlement, can never break the utilization cap or pay out from
        // funds currently locked behind active bets.
        if (!settled) {
            uint256 unlocked = totalLiquidity - lockedForPayouts;
            if (usdcOut > unlocked) revert InsufficientUnlockedLiquidity();
        }

        // Burn shares before transferring out.
        shares[msg.sender] = 0;
        totalShares -= userShares;
        totalLiquidity = totalLiquidity > usdcOut ? totalLiquidity - usdcOut : 0;
        withdrawalRequestTime[msg.sender] = 0;
        depositedPrincipal[msg.sender] = 0;

        usdc.safeTransfer(msg.sender, usdcOut);

        emit WithdrawalExecuted(msg.sender, userShares, usdcOut);
    }

    // -----------------------------------------------------------------------
    // BettingCore-only hooks
    // -----------------------------------------------------------------------

    /// @inheritdoc IMarketLiquidityPool
    function lockLiquidity(uint256 amount) external override onlyBettingCore {
        if (amount == 0) revert ZeroAmount();
        uint256 newLocked = lockedForPayouts + amount;
        // Enforce utilization cap on totalLiquidity.
        if (newLocked * BPS_DENOM > totalLiquidity * MAX_POOL_UTILIZATION_BPS) {
            revert UtilizationCapExceeded();
        }
        lockedForPayouts = newLocked;
        emit LiquidityLocked(amount, newLocked);
    }

    /// @inheritdoc IMarketLiquidityPool
    function unlockLiquidity(uint256 amount) external override onlyBettingCore {
        if (amount == 0) revert ZeroAmount();
        if (amount > lockedForPayouts) revert UnlockExceedsLocked();
        lockedForPayouts -= amount;
        emit LiquidityUnlocked(amount, lockedForPayouts);
    }

    /// @inheritdoc IMarketLiquidityPool
    function settlePool(uint256 totalBetAmount, uint256 totalPayoutRequired)
        external
        override
        onlyBettingCore
    {
        if (settled) revert PoolAlreadySettled();

        if (totalPayoutRequired > totalBetAmount) {
            // LPs lose: pool funds the deficit to the BettingCore.
            uint256 deficit = totalPayoutRequired - totalBetAmount;
            // Reduce accounting before transfer.
            totalLiquidity = totalLiquidity > deficit ? totalLiquidity - deficit : 0;
            usdc.safeTransfer(bettingCore, deficit);
        } else {
            // LPs gain: BettingCore is expected to have already pushed the
            // surplus into this pool. Reconcile accounting with the current
            // USDC balance held.
            uint256 balance = usdc.balanceOf(address(this));
            if (balance > totalLiquidity) {
                totalLiquidity = balance;
            }
        }

        lockedForPayouts = 0;
        settled = true;
        settlementShareValueX1e18 = totalShares == 0
            ? 1e18
            : (totalLiquidity * 1e18) / totalShares;

        emit PoolSettled(totalBetAmount, totalPayoutRequired, settlementShareValueX1e18);
    }

    // -----------------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------------

    /// @inheritdoc IMarketLiquidityPool
    function getShareValue() public view override returns (uint256) {
        if (totalShares == 0) return 1e18;
        return (totalLiquidity * 1e18) / totalShares;
    }

    /// @inheritdoc IMarketLiquidityPool
    function getUserPosition(address user)
        external
        view
        override
        returns (uint256 usdcValue, uint256 earnedProfit)
    {
        uint256 userShares = shares[user];
        if (userShares == 0) return (0, 0);
        uint256 shareValue = settled ? settlementShareValueX1e18 : getShareValue();
        usdcValue = (userShares * shareValue) / 1e18;
        uint256 principal = depositedPrincipal[user];
        earnedProfit = usdcValue > principal ? usdcValue - principal : 0;
    }
}
