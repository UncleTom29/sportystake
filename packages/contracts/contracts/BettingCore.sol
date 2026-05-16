// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IBettingCore} from "./interfaces/IBettingCore.sol";
import {IMarketLiquidityPool} from "./interfaces/IMarketLiquidityPool.sol";
import {IMarketPoolFactory} from "./interfaces/IMarketPoolFactory.sol";

/// @title BettingCore
/// @notice Central contract for placing, settling, and claiming sports bets.
contract BettingCore is IBettingCore, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -----------------------------------------------------------------------
    // Roles
    // -----------------------------------------------------------------------

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    uint256 private constant BPS_DENOM = 10000;
    uint256 private constant ODDS_DENOM = 1000;

    // -----------------------------------------------------------------------
    // Storage
    // -----------------------------------------------------------------------

    IERC20 public immutable usdc;
    IMarketPoolFactory public immutable factory;

    /// @notice Treasury address that receives the house edge.
    address public treasury;

    /// @notice House edge in basis points (200 = 2%).
    uint256 public houseEdgeBps = 200;

    /// @notice Lower bound on a single bet (5 USDC).
    uint256 public minBet = 5e6;

    /// @notice Upper bound on a single bet (10,000 USDC).
    uint256 public maxBet = 10000e6;

    /// @notice Per-bettor monotonic nonce, used to derive bet IDs.
    mapping(address => uint256) public nextBetNonce;

    struct Bet {
        address bettor;
        bytes32 marketId;
        uint8 outcome;
        uint256 amount;
        uint256 potentialPayout;
        BetStatus status;
        uint256 oddsX1000;
        uint64 placedAt;
    }

    struct Market {
        bytes32 id;
        MarketStatus status;
        uint8 winningOutcome;
        uint256 totalBetAmount;
        uint256 totalPayoutRequired;
        address poolAddress;
        uint64 closesAt;
    }

    mapping(bytes32 => Bet) public bets;
    mapping(bytes32 => Market) public markets;

    // -----------------------------------------------------------------------
    // Errors
    // -----------------------------------------------------------------------

    error MarketAlreadyExists();
    error MarketNotFound();
    error MarketNotOpen();
    error MarketNotSettled();
    error MarketNotCancelled();
    error MarketAlreadySettled();
    error MarketAlreadyCancelled();
    error BetAmountOutOfRange();
    error OddsBelowSlippage();
    error InvalidOdds();
    error BetNotFound();
    error BetNotWon();
    error BetNotRefundable();
    error NotBetOwner();
    error InvalidTreasury();
    error InvalidHouseEdge();
    error InvalidBetLimits();
    error InvalidClosesAt();

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event MarketCreated(bytes32 indexed marketId, address indexed pool, uint64 closesAt);
    event MarketSuspended(bytes32 indexed marketId);
    event MarketResumed(bytes32 indexed marketId);
    event MarketSettled(
        bytes32 indexed marketId,
        uint8 winningOutcome,
        uint256 totalBetAmount,
        uint256 totalPayoutRequired,
        uint256 houseEdge
    );
    event MarketCancelled(bytes32 indexed marketId);

    event BetPlaced(
        bytes32 indexed betId,
        bytes32 indexed marketId,
        address indexed bettor,
        uint8 outcome,
        uint256 amount,
        uint256 potentialPayout,
        uint256 oddsX1000
    );
    event BetSettled(bytes32 indexed betId, BetStatus status);
    event WinningsClaimed(bytes32 indexed betId, address indexed bettor, uint256 amount);
    event RefundClaimed(bytes32 indexed betId, address indexed bettor, uint256 amount);

    event HouseEdgeUpdated(uint256 oldBps, uint256 newBps);
    event BetLimitsUpdated(uint256 minBet, uint256 maxBet);
    event TreasuryUpdated(address indexed treasury);

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /// @param _usdc USDC token (6 decimals).
    /// @param _factory MarketPoolFactory deployed beforehand.
    /// @param _treasury Address receiving the house edge.
    /// @param admin Address granted ADMIN, OPERATOR, PAUSER + DEFAULT_ADMIN.
    constructor(address _usdc, address _factory, address _treasury, address admin) {
        if (_treasury == address(0)) revert InvalidTreasury();
        usdc = IERC20(_usdc);
        factory = IMarketPoolFactory(_factory);
        treasury = _treasury;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // -----------------------------------------------------------------------
    // Market lifecycle (OPERATOR)
    // -----------------------------------------------------------------------

    /// @notice Create a market and its dedicated liquidity pool.
    function createMarket(bytes32 marketId, uint256 closesAt)
        external
        onlyRole(OPERATOR_ROLE)
        returns (address pool)
    {
        if (marketId == bytes32(0)) revert MarketNotFound();
        if (markets[marketId].id != bytes32(0)) revert MarketAlreadyExists();
        if (closesAt <= block.timestamp) revert InvalidClosesAt();

        pool = factory.createPool(marketId, address(this));

        markets[marketId] = Market({
            id: marketId,
            status: MarketStatus.Open,
            winningOutcome: 0,
            totalBetAmount: 0,
            totalPayoutRequired: 0,
            poolAddress: pool,
            closesAt: uint64(closesAt)
        });

        emit MarketCreated(marketId, pool, uint64(closesAt));
    }

    /// @notice Temporarily disable bet placement on a market.
    function suspendMarket(bytes32 marketId) external onlyRole(OPERATOR_ROLE) {
        Market storage m = _market(marketId);
        if (m.status != MarketStatus.Open) revert MarketNotOpen();
        m.status = MarketStatus.Suspended;
        emit MarketSuspended(marketId);
    }

    /// @notice Re-enable bet placement on a previously suspended market.
    function resumeMarket(bytes32 marketId) external onlyRole(OPERATOR_ROLE) {
        Market storage m = _market(marketId);
        if (m.status != MarketStatus.Suspended) revert MarketNotOpen();
        m.status = MarketStatus.Open;
        emit MarketResumed(marketId);
    }

    // -----------------------------------------------------------------------
    // Bet placement (PUBLIC)
    // -----------------------------------------------------------------------

    /// @inheritdoc IBettingCore
    function placeBet(
        bytes32 marketId,
        uint8 outcome,
        uint256 amount,
        uint256 oddsX1000,
        uint256 minOddsX1000
    ) external override whenNotPaused nonReentrant returns (bytes32 betId) {
        Market storage m = _market(marketId);
        if (m.status != MarketStatus.Open) revert MarketNotOpen();
        if (amount < minBet || amount > maxBet) revert BetAmountOutOfRange();
        if (oddsX1000 <= ODDS_DENOM) revert InvalidOdds();
        if (oddsX1000 < minOddsX1000) revert OddsBelowSlippage();

        uint256 potentialPayout = (amount * oddsX1000) / ODDS_DENOM;
        uint256 lockNeeded = potentialPayout - amount;

        // Lock LP collateral covering the payout-on-loss.
        IMarketLiquidityPool(m.poolAddress).lockLiquidity(lockNeeded);

        // Build bet ID from (market, bettor, nonce).
        uint256 nonce = nextBetNonce[msg.sender]++;
        betId = keccak256(abi.encodePacked(marketId, msg.sender, nonce));

        bets[betId] = Bet({
            bettor: msg.sender,
            marketId: marketId,
            outcome: outcome,
            amount: amount,
            potentialPayout: potentialPayout,
            status: BetStatus.Pending,
            oddsX1000: oddsX1000,
            placedAt: uint64(block.timestamp)
        });

        m.totalBetAmount += amount;

        // Pull stake from the bettor — held by BettingCore until settlement.
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit BetPlaced(betId, marketId, msg.sender, outcome, amount, potentialPayout, oddsX1000);
    }

    // -----------------------------------------------------------------------
    // Market settlement (OPERATOR)
    // -----------------------------------------------------------------------

    /// @notice Settle a market by enumerating every winning bet.
    /// @dev `totalPayoutRequired` MUST equal the sum of `winningBetIds[i].potentialPayout`.
    function settleMarket(
        bytes32 marketId,
        uint8 winningOutcome,
        bytes32[] calldata winningBetIds,
        uint256 totalPayoutRequired
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        Market storage m = _market(marketId);
        if (m.status == MarketStatus.Settled) revert MarketAlreadySettled();
        if (m.status == MarketStatus.Cancelled) revert MarketAlreadyCancelled();

        m.status = MarketStatus.Settled;
        m.winningOutcome = winningOutcome;
        m.totalPayoutRequired = totalPayoutRequired;

        // Flag listed bets as Won.
        uint256 verifyPayout;
        for (uint256 i = 0; i < winningBetIds.length; ++i) {
            bytes32 betId = winningBetIds[i];
            Bet storage b = bets[betId];
            if (b.bettor == address(0)) revert BetNotFound();
            if (b.marketId != marketId) revert BetNotFound();
            if (b.status != BetStatus.Pending) continue;
            b.status = BetStatus.Won;
            verifyPayout += b.potentialPayout;
            emit BetSettled(betId, BetStatus.Won);
        }
        // Sanity-check operator's payout total against the on-chain sum.
        require(verifyPayout == totalPayoutRequired, "payout mismatch");

        IMarketLiquidityPool pool = IMarketLiquidityPool(m.poolAddress);

        uint256 totalBetAmount = m.totalBetAmount;
        uint256 houseEdge;

        if (totalPayoutRequired < totalBetAmount) {
            // Pool wins. Treasury collects `houseEdgeBps` of stakes;
            // remaining surplus is pushed back to the LP pool.
            houseEdge = (totalBetAmount * houseEdgeBps) / BPS_DENOM;
            uint256 surplus = totalBetAmount - totalPayoutRequired;
            if (surplus < houseEdge) {
                // Edge case: vig exceeds surplus — give pool the surplus,
                // treasury the deficit shortfall (zero in practice).
                houseEdge = surplus;
            }
            uint256 toPool = surplus - houseEdge;

            if (toPool > 0) {
                usdc.safeTransfer(address(pool), toPool);
            }
            if (houseEdge > 0) {
                usdc.safeTransfer(treasury, houseEdge);
            }
            // Tell the pool to reconcile from its new balance.
            pool.settlePool(totalBetAmount, totalPayoutRequired);
        } else {
            // Pool loses (or breaks even). Pool ships the deficit to us so
            // we can pay winning bettors. No vig is taken on losses.
            pool.settlePool(totalBetAmount, totalPayoutRequired);
        }

        emit MarketSettled(
            marketId,
            winningOutcome,
            totalBetAmount,
            totalPayoutRequired,
            houseEdge
        );
    }

    // -----------------------------------------------------------------------
    // Bettor claims (PUBLIC)
    // -----------------------------------------------------------------------

    /// @inheritdoc IBettingCore
    function claimWinnings(bytes32 betId) external override nonReentrant {
        Bet storage b = bets[betId];
        if (b.bettor == address(0)) revert BetNotFound();
        if (b.bettor != msg.sender) revert NotBetOwner();
        if (b.status != BetStatus.Won) revert BetNotWon();

        b.status = BetStatus.Cashed;
        uint256 payout = b.potentialPayout;

        usdc.safeTransfer(msg.sender, payout);
        emit WinningsClaimed(betId, msg.sender, payout);
    }

    /// @inheritdoc IBettingCore
    function claimRefund(bytes32 betId) external override nonReentrant {
        Bet storage b = bets[betId];
        if (b.bettor == address(0)) revert BetNotFound();
        if (b.bettor != msg.sender) revert NotBetOwner();
        if (b.status != BetStatus.Pending) revert BetNotRefundable();

        Market storage m = markets[b.marketId];
        if (m.status != MarketStatus.Cancelled) revert MarketNotCancelled();

        b.status = BetStatus.Cancelled;
        uint256 refundAmount = b.amount;

        usdc.safeTransfer(msg.sender, refundAmount);
        emit RefundClaimed(betId, msg.sender, refundAmount);
    }

    // -----------------------------------------------------------------------
    // Cancellation (OPERATOR)
    // -----------------------------------------------------------------------

    /// @notice Cancel a market. Bettors then pull their refunds individually.
    function cancelMarket(bytes32 marketId) external onlyRole(OPERATOR_ROLE) {
        Market storage m = _market(marketId);
        if (m.status == MarketStatus.Settled) revert MarketAlreadySettled();
        if (m.status == MarketStatus.Cancelled) revert MarketAlreadyCancelled();

        m.status = MarketStatus.Cancelled;

        // Release any locks so LPs can withdraw post-settlement.
        IMarketLiquidityPool pool = IMarketLiquidityPool(m.poolAddress);
        // Treat as a zero-bet / zero-payout settlement to flip the `settled`
        // flag and reset locked accounting.
        pool.settlePool(m.totalBetAmount, m.totalBetAmount);

        emit MarketCancelled(marketId);
    }

    // -----------------------------------------------------------------------
    // Pausable (PAUSER)
    // -----------------------------------------------------------------------

    /// @notice Emergency stop on bet placement.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Resume bet placement.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // -----------------------------------------------------------------------
    // Admin setters
    // -----------------------------------------------------------------------

    /// @notice Update house edge in basis points. Hard cap: 10%.
    function setHouseEdge(uint256 newBps) external onlyRole(ADMIN_ROLE) {
        if (newBps > 1000) revert InvalidHouseEdge();
        uint256 old = houseEdgeBps;
        houseEdgeBps = newBps;
        emit HouseEdgeUpdated(old, newBps);
    }

    /// @notice Update per-bet bounds.
    function setBetLimits(uint256 newMin, uint256 newMax) external onlyRole(ADMIN_ROLE) {
        if (newMin == 0 || newMin > newMax) revert InvalidBetLimits();
        minBet = newMin;
        maxBet = newMax;
        emit BetLimitsUpdated(newMin, newMax);
    }

    /// @notice Update the treasury sink for the house edge.
    function setTreasury(address newTreasury) external onlyRole(ADMIN_ROLE) {
        if (newTreasury == address(0)) revert InvalidTreasury();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    function _market(bytes32 marketId) internal view returns (Market storage m) {
        m = markets[marketId];
        if (m.id == bytes32(0)) revert MarketNotFound();
    }
}
