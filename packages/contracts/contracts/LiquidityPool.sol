// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {ReentrancyGuardUpgradeable} from "./vendor/ReentrancyGuardUpgradeable.sol";
import {ILiquidityPool} from "./interfaces/ILiquidityPool.sol";

/// @title LiquidityPool
/// @notice Single, protocol-wide USDC liquidity pool backing every market on
///         BettingCore. Any user (or the protocol itself) can permissionlessly
///         deposit to become an LP. Bet placement is never capped by
///         available liquidity — solvency is instead enforced at settlement
///         time via a per-market fill ratio (see BettingCore.claimWinnings),
///         which scales a winner's payout between their stake (floor) and
///         the full quoted odds (ceiling) based on real free capacity.
/// @dev UUPS upgradeable. Mutating LP-only operations are `nonReentrant`;
///      operations that touch payout liquidity are restricted to `bettingCore`.
contract LiquidityPool is
    ILiquidityPool,
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // -----------------------------------------------------------------------
    // Roles
    // -----------------------------------------------------------------------

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    /// @notice Minimum USDC accepted on a single deposit (10 USDC, 6 decimals).
    uint256 public constant MIN_DEPOSIT = 10e6;

    /// @notice Cooldown between `requestWithdrawal` and `executeWithdrawal`.
    uint256 public constant WITHDRAWAL_TIMELOCK = 48 hours;

    // -----------------------------------------------------------------------
    // Immutables / state
    // -----------------------------------------------------------------------

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IERC20 public immutable override usdc;

    /// @notice The BettingCore contract authorized to lock/unlock/report.
    ///         Admin-settable (not immutable) so the pool can be repointed if
    ///         BettingCore is ever redeployed behind a new proxy.
    address public override bettingCore;

    uint256 public override totalLiquidity;
    uint256 public override totalShares;
    uint256 public override lockedForPayouts;

    /// @notice Admin-set, display-only capacity credit — adds to
    ///         `getEffectiveCapacity()`'s reported figure but is NOT real
    ///         USDC and is never read by any balance-moving logic (deposits,
    ///         withdrawals, settlement). Purely cosmetic: makes the pool
    ///         look better-capitalized in the UI without backing anything.
    uint256 public override virtualLiquidity;

    /// @notice Shares owned by each LP.
    mapping(address => uint256) public shares;

    /// @notice Cumulative USDC each LP has deposited (basis for profit calc).
    mapping(address => uint256) public depositedPrincipal;

    /// @notice Timestamp of pending withdrawal request, 0 if none.
    mapping(address => uint256) public withdrawalRequestTime;

    /// @notice Currently-locked liquidity attributable to each market.
    mapping(bytes32 => uint256) public override marketLocked;

    uint256[50] private __gap;

    // -----------------------------------------------------------------------
    // Errors
    // -----------------------------------------------------------------------

    error OnlyBettingCore();
    error DepositTooSmall();
    error NoSharesOwned();
    error WithdrawalNotRequested();
    error WithdrawalTimelockActive();
    error InsufficientUnlockedLiquidity();
    error UnlockExceedsLocked();
    error InsufficientVirtualLiquidity();
    error InvalidBettingCore();
    error ZeroAmount();

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event Deposited(address indexed lp, uint256 usdcAmount, uint256 sharesMinted);
    event WithdrawalRequested(address indexed lp, uint256 unlockAt);
    event WithdrawalExecuted(address indexed lp, uint256 sharesBurned, uint256 usdcOut);
    event LiquidityLocked(bytes32 indexed marketId, uint256 amount, uint256 totalLocked);
    event LiquidityUnlocked(bytes32 indexed marketId, uint256 amount, uint256 totalLocked);
    event MarketResultReported(
        bytes32 indexed marketId,
        uint256 totalBetAmount,
        uint256 totalPayoutRequired,
        uint256 shareValueX1e18
    );
    event VirtualLiquidityAdded(address indexed admin, uint256 amount);
    event VirtualLiquidityRemoved(address indexed admin, uint256 amount);
    event BettingCoreUpdated(address indexed bettingCore);

    // -----------------------------------------------------------------------
    // Modifiers
    // -----------------------------------------------------------------------

    modifier onlyBettingCore() {
        if (msg.sender != bettingCore) revert OnlyBettingCore();
        _;
    }

    // -----------------------------------------------------------------------
    // Constructor / initializer
    // -----------------------------------------------------------------------

    /// @param _usdc USDC token (6 decimals) backing this pool. Immutable —
    ///        baked into every implementation's bytecode, identical across upgrades.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        _disableInitializers();
    }

    /// @param admin Address granted DEFAULT_ADMIN_ROLE + ADMIN_ROLE.
    function initialize(address admin) external initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // -----------------------------------------------------------------------
    // LP entry / exit (PUBLIC — permissionless)
    // -----------------------------------------------------------------------

    /// @inheritdoc ILiquidityPool
    function deposit(uint256 usdcAmount)
        external
        override
        nonReentrant
        returns (uint256 sharesMinted)
    {
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

    /// @inheritdoc ILiquidityPool
    function requestWithdrawal() external override {
        if (shares[msg.sender] == 0) revert NoSharesOwned();
        withdrawalRequestTime[msg.sender] = block.timestamp;
        emit WithdrawalRequested(msg.sender, block.timestamp + WITHDRAWAL_TIMELOCK);
    }

    /// @inheritdoc ILiquidityPool
    function executeWithdrawal()
        external
        override
        nonReentrant
        returns (uint256 usdcOut)
    {
        uint256 userShares = shares[msg.sender];
        if (userShares == 0) revert NoSharesOwned();

        uint256 requestedAt = withdrawalRequestTime[msg.sender];
        if (requestedAt == 0) revert WithdrawalNotRequested();
        if (block.timestamp < requestedAt + WITHDRAWAL_TIMELOCK) {
            revert WithdrawalTimelockActive();
        }

        uint256 shareValue = getShareValue();
        usdcOut = (userShares * shareValue) / 1e18;

        // Can never break the utilization cap or pay out from funds
        // currently locked behind active bets.
        uint256 unlocked = totalLiquidity - lockedForPayouts;
        if (usdcOut > unlocked) revert InsufficientUnlockedLiquidity();

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

    /// @inheritdoc ILiquidityPool
    /// @dev Deliberately uncapped — a bet is never rejected for lack of pool
    ///      capacity. `lockedForPayouts` can exceed real balance; that's
    ///      resolved at settlement time by `BettingCore`'s fill-ratio scaling
    ///      (see `getFreeLiquidity`), not by blocking placement up front.
    function lockLiquidity(bytes32 marketId, uint256 amount) external override onlyBettingCore {
        if (amount == 0) revert ZeroAmount();
        uint256 newLocked = lockedForPayouts + amount;
        lockedForPayouts = newLocked;
        marketLocked[marketId] += amount;
        emit LiquidityLocked(marketId, amount, newLocked);
    }

    /// @inheritdoc ILiquidityPool
    /// @dev Real balance only — `virtualLiquidity` is cosmetic (see its
    ///      declaration above) and must never influence how much this
    ///      contract is actually willing/able to pay out.
    function getFreeLiquidity(bytes32 settlingMarketId) external view override returns (uint256) {
        uint256 otherLocks = lockedForPayouts > marketLocked[settlingMarketId]
            ? lockedForPayouts - marketLocked[settlingMarketId]
            : 0;
        uint256 bal = usdc.balanceOf(address(this));
        return bal > otherLocks ? bal - otherLocks : 0;
    }

    /// @inheritdoc ILiquidityPool
    function unlockLiquidity(bytes32 marketId, uint256 amount) external override onlyBettingCore {
        if (amount == 0) revert ZeroAmount();
        if (amount > lockedForPayouts) revert UnlockExceedsLocked();
        if (amount > marketLocked[marketId]) revert UnlockExceedsLocked();
        lockedForPayouts -= amount;
        marketLocked[marketId] -= amount;
        emit LiquidityUnlocked(marketId, amount, lockedForPayouts);
    }

    /// @inheritdoc ILiquidityPool
    function reportMarketResult(bytes32 marketId, uint256 totalBetAmount, uint256 totalPayoutRequired)
        external
        override
        onlyBettingCore
    {
        uint256 locked = marketLocked[marketId];
        if (locked > 0) {
            marketLocked[marketId] = 0;
            lockedForPayouts -= locked;
        }

        if (totalPayoutRequired > totalBetAmount) {
            // Pool loses: the deficit always comes out of real liquidity —
            // `virtualLiquidity` is a display-only capacity credit (see its
            // declaration above), not real USDC sitting in this contract, so
            // it must never be netted against an actual token transfer.
            uint256 deficit = totalPayoutRequired - totalBetAmount;
            totalLiquidity = totalLiquidity > deficit ? totalLiquidity - deficit : 0;
            usdc.safeTransfer(bettingCore, deficit);
        } else {
            // Pool gains: BettingCore is expected to have already pushed the
            // surplus into this pool. Reconcile real liquidity from the new
            // balance — deliberately excludes `virtualLiquidity` from
            // `accounted`, since that credit was never part of `balance` to
            // begin with.
            uint256 balance = usdc.balanceOf(address(this));
            if (balance > totalLiquidity) {
                totalLiquidity += (balance - totalLiquidity);
            }
        }

        emit MarketResultReported(marketId, totalBetAmount, totalPayoutRequired, getShareValue());
    }

    // -----------------------------------------------------------------------
    // Virtual liquidity (ADMIN)
    // -----------------------------------------------------------------------

    /// @inheritdoc ILiquidityPool
    /// @dev No real USDC moves here — `virtualLiquidity` is a display-only
    ///      credit that raises `getEffectiveCapacity()`'s reported figure.
    ///      Bet placement itself is never gated by liquidity (see
    ///      `lockLiquidity`); actual solvency is enforced at settlement via
    ///      `BettingCore`'s fill-ratio scaling against `getFreeLiquidity()`,
    ///      which reads real balance only and never sees this number.
    function addVirtualLiquidity(uint256 amount) external override onlyRole(ADMIN_ROLE) {
        if (amount == 0) revert ZeroAmount();
        virtualLiquidity += amount;
        emit VirtualLiquidityAdded(msg.sender, amount);
    }

    /// @inheritdoc ILiquidityPool
    function removeVirtualLiquidity(uint256 amount) external override onlyRole(ADMIN_ROLE) {
        if (amount == 0) revert ZeroAmount();
        if (amount > virtualLiquidity) revert InsufficientVirtualLiquidity();
        virtualLiquidity -= amount;
        emit VirtualLiquidityRemoved(msg.sender, amount);
    }

    // -----------------------------------------------------------------------
    // Admin setters
    // -----------------------------------------------------------------------

    /// @notice Point this pool at a (possibly redeployed) BettingCore.
    function setBettingCore(address newBettingCore) external onlyRole(ADMIN_ROLE) {
        if (newBettingCore == address(0)) revert InvalidBettingCore();
        bettingCore = newBettingCore;
        emit BettingCoreUpdated(newBettingCore);
    }

    // -----------------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------------

    /// @inheritdoc ILiquidityPool
    function getShareValue() public view override returns (uint256) {
        if (totalShares == 0) return 1e18;
        return (totalLiquidity * 1e18) / totalShares;
    }

    /// @inheritdoc ILiquidityPool
    function getUserPosition(address user)
        external
        view
        override
        returns (uint256 usdcValue, uint256 earnedProfit)
    {
        uint256 userShares = shares[user];
        if (userShares == 0) return (0, 0);
        usdcValue = (userShares * getShareValue()) / 1e18;
        uint256 principal = depositedPrincipal[user];
        earnedProfit = usdcValue > principal ? usdcValue - principal : 0;
    }

    /// @inheritdoc ILiquidityPool
    function getEffectiveCapacity() public view override returns (uint256) {
        return totalLiquidity + virtualLiquidity;
    }

    // -----------------------------------------------------------------------
    // UUPS
    // -----------------------------------------------------------------------

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
