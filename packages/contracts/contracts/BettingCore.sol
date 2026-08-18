// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";

import {ReentrancyGuardUpgradeable} from "./vendor/ReentrancyGuardUpgradeable.sol";
import {IBettingCore} from "./interfaces/IBettingCore.sol";
import {ILiquidityPool} from "./interfaces/ILiquidityPool.sol";

/// @title BettingCore
/// @notice Central contract for placing, settling, and claiming sports bets.
///         Backed by a single, shared `LiquidityPool` rather than one pool
///         per market.
contract BettingCore is
    IBettingCore,
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // -----------------------------------------------------------------------
    // Roles
    // -----------------------------------------------------------------------

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Signs `MarketAttestation` tickets that let anyone permissionlessly
    ///         register a market via `placeBetWithAttestation`/`placeParlayBetWithAttestations`.
    ///         Deliberately separate from OPERATOR_ROLE: a leaked signer key can
    ///         only forge market registrations (recoverable via cancelMarket),
    ///         never settle bets or move funds.
    bytes32 public constant ORACLE_SIGNER_ROLE = keccak256("ORACLE_SIGNER_ROLE");

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    uint256 private constant BPS_DENOM = 10000;
    uint256 private constant ODDS_DENOM = 1000;

    /// @dev keccak256("MarketAttestation(bytes32 marketId,uint64 closesAt,uint64 validUntil)")
    bytes32 private constant MARKET_ATTESTATION_TYPEHASH =
        keccak256("MarketAttestation(bytes32 marketId,uint64 closesAt,uint64 validUntil)");

    // -----------------------------------------------------------------------
    // Storage
    // -----------------------------------------------------------------------

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IERC20 public immutable usdc;

    /// @notice The single shared liquidity pool backing every market.
    ///         Admin-settable for migration flexibility.
    ILiquidityPool public liquidityPool;

    /// @notice Treasury address that receives the house edge.
    address public treasury;

    /// @notice House edge in basis points (200 = 2%), hard-capped at 1000
    ///         (10%) by setHouseEdge. Used two ways: (1) a cut of the
    ///         surplus when a market/parlay nets a profit for the pool
    ///         (_finalizeMarketAccounting, reportParlayLoss), and (2) a
    ///         reservation off the LiquidityPool's free capacity before any
    ///         of it is offered to cover a winning payout's deficit
    ///         (_computeMarketFillRatio, claimParlayWinnings) — one
    ///         consistent margin regardless of which side of a bet the
    ///         house is settling.
    uint256 public houseEdgeBps;

    /// @notice Lower bound on a single bet (5 USDC).
    uint256 public minBet;

    /// @notice Upper bound on a single bet (10,000 USDC).
    uint256 public maxBet;

    /// @notice Upper bound on `winningBetIds.length` for a single settlement
    ///         call. Caps gas exposure and prevents an operator from being
    ///         locked into a single-tx settlement that can't fit in a block.
    ///         Operators MUST batch large markets across multiple calls.
    uint256 public constant MAX_SETTLE_BATCH = 500;

    /// @notice Bounds on the number of legs in a single parlay. Caps the gas
    ///         cost of `_evaluateParlay`'s per-claim scan over legs.
    uint256 public constant MIN_PARLAY_LEGS = 2;
    uint256 public constant MAX_PARLAY_LEGS = 10;

    /// @notice Per-bettor monotonic nonce, used to derive bet IDs.
    mapping(address => uint256) public nextBetNonce;

    /// @notice Per-bettor monotonic nonce, used to derive parlay IDs.
    ///         Kept separate from `nextBetNonce` so single-bet and parlay
    ///         placement don't contend over the same counter.
    mapping(address => uint256) public nextParlayNonce;

    struct Bet {
        address bettor;
        bytes32 marketId;
        uint8 outcome;
        uint256 amount;
        uint256 potentialPayout;
        BetStatus status;
        uint256 oddsX1000;
        uint64 placedAt;
        /// @notice Actual amount locked in the LiquidityPool for this bet at
        ///         placement time (see _probabilityWeightedLock) — stored
        ///         rather than recomputed so voidBet's unlock always matches
        ///         the lock exactly, even if probabilitySafetyMultiplierBps
        ///         changes in between.
        uint256 lockedAmount;
    }

    struct Market {
        bytes32 id;
        MarketStatus status;
        uint8 winningOutcome;
        uint256 totalBetAmount;
        uint256 totalPayoutRequired;
        uint64 closesAt;
        /// @notice Solvency-aware payout scaling factor set at settlement time.
        ///         1000 = full quoted payout, 0 = stake refund only.
        ///         Shared by every winner on this market; used by `claimWinnings`
        ///         to compute: payout = amount + fillRatioX1000 × (potentialPayout − amount) / 1000.
        uint256 fillRatioX1000;
    }

    /// @notice A multi-leg bet across distinct markets, won only if every
    ///         leg wins. Backed by the same shared `LiquidityPool` as single
    ///         bets — the parlay's own id doubles as the pool's accounting
    ///         key, so no pool-side changes are needed to support this.
    struct Parlay {
        address bettor;
        bytes32[] marketIds;
        uint8[] outcomes;
        uint256 stake;
        uint256 potentialPayout;
        /// @dev Reuses `BetStatus`: Pending until resolved, Won once paid,
        ///      Cancelled once refunded, Lost once reconciled by
        ///      `reportParlayLoss`. Never `Cashed` — there's no separate
        ///      settle-then-claim step for parlays, winnings pay out in the
        ///      same call that determines eligibility.
        BetStatus status;
        uint256 combinedOddsX1000;
        uint64 placedAt;
    }

    /// @notice Per-leg resolution used internally to decide whether a
    ///         parlay can be claimed, refunded, or reconciled as a loss.
    enum LegVerdict {
        Pending,
        Won,
        Lost,
        Void
    }

    mapping(bytes32 => Bet) public bets;
    mapping(bytes32 => Market) public markets;

    /// @dev Private — a public mapping getter would silently drop the
    ///      dynamic `marketIds`/`outcomes` array members. Use `getParlay`.
    mapping(bytes32 => Parlay) private _parlays;

    /// @notice Multiplier (bps, 10000 = 1.0x) applied when reserving pool
    ///         capacity for a still-pending bet/parlay at placement time
    ///         (see `_probabilityWeightedLock`): lockNeeded = deficit ×
    ///         impliedWinProbability × this, instead of the full worst-case
    ///         deficit — a long-shot no longer reserves as much capacity as
    ///         a near-even-money bet paying the same amount. 10000 is the
    ///         floor (pure expected value, no safety buffer); default 15000
    ///         (1.5x) leaves headroom for odds mispricing and correlated
    ///         outcomes. `_probabilityWeightedLock` falls back to 10000 if
    ///         this is left at its zero default, so a missed setup step
    ///         after an upgrade degrades to "no safety buffer" rather than
    ///         "no reservation at all". Independent of `houseEdgeBps`, which
    ///         only affects claim-time payouts (what a WON bet is actually
    ///         paid), not how much a still-PENDING bet reserves.
    uint256 public probabilitySafetyMultiplierBps;

    uint256[49] private __gap;

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
    error MarketClosed();
    error BetAmountOutOfRange();
    error OddsBelowSlippage();
    error InvalidOdds();
    error BetNotFound();
    error BetNotWon();
    error BetNotRefundable();
    error NotBetOwner();
    error InvalidTreasury();
    error InvalidHouseEdge();
    error InvalidProbabilitySafetyMultiplier();
    error InvalidBetLimits();
    error InvalidClosesAt();
    error PayoutSumMismatch();
    error TooManyBets();
    error InvalidLiquidityPool();
    error InvalidOracleSignature();
    error AttestationExpired();

    error TooFewLegs();
    error TooManyLegs();
    error LegCountMismatch();
    error DuplicateMarketInParlay();
    error ParlayNotFound();
    error NotParlayOwner();
    error ParlayAlreadyResolved();
    error ParlayNotReady();
    error ParlayNotWon();
    error ParlayNotVoid();
    error ParlayNotLost();

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event MarketCreated(bytes32 indexed marketId, uint64 closesAt);
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
    event BetVoided(bytes32 indexed betId, address indexed bettor, uint256 amount);

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
    event ProbabilitySafetyMultiplierUpdated(uint256 oldBps, uint256 newBps);
    event BetLimitsUpdated(uint256 minBet, uint256 maxBet);
    event TreasuryUpdated(address indexed treasury);
    event LiquidityPoolUpdated(address indexed liquidityPool);

    event ParlayPlaced(
        bytes32 indexed parlayId,
        address indexed bettor,
        bytes32[] marketIds,
        uint8[] outcomes,
        uint256 stake,
        uint256 potentialPayout,
        uint256 combinedOddsX1000
    );
    event ParlayWon(bytes32 indexed parlayId, address indexed bettor, uint256 payout);
    event ParlayRefunded(bytes32 indexed parlayId, address indexed bettor, uint256 amount);
    event ParlayLost(bytes32 indexed parlayId, address indexed bettor, uint256 stake, uint256 houseEdge);

    // -----------------------------------------------------------------------
    // Constructor / initializer
    // -----------------------------------------------------------------------

    /// @param _usdc USDC token (6 decimals). Immutable — identical across upgrades.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        _disableInitializers();
    }

    /// @param _liquidityPool The shared LiquidityPool backing every market.
    /// @param _treasury Address receiving the house edge.
    /// @param admin Address granted ADMIN, OPERATOR, PAUSER + DEFAULT_ADMIN.
    function initialize(address _liquidityPool, address _treasury, address admin) external initializer {
        if (_liquidityPool == address(0)) revert InvalidLiquidityPool();
        if (_treasury == address(0)) revert InvalidTreasury();

        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        liquidityPool = ILiquidityPool(_liquidityPool);
        treasury = _treasury;
        houseEdgeBps = 200;
        minBet = 5e6;
        maxBet = 10000e6;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /// @notice V2 upgrade hook — wires the EIP-712 domain separator and
    ///         grants the first oracle-signer key. Run once, immediately
    ///         after upgrading the proxy to this implementation.
    /// @custom:oz-upgrades-validate-as-initializer
    function initializeV2(address initialOracleSigner) external reinitializer(2) onlyRole(DEFAULT_ADMIN_ROLE) {
        __EIP712_init("BettingCore", "1");
        if (initialOracleSigner != address(0)) {
            _grantRole(ORACLE_SIGNER_ROLE, initialOracleSigner);
        }
    }

    // -----------------------------------------------------------------------
    // Market lifecycle (OPERATOR)
    // -----------------------------------------------------------------------

    /// @notice Register a new market against the shared liquidity pool.
    function createMarket(bytes32 marketId, uint256 closesAt) external onlyRole(OPERATOR_ROLE) {
        if (markets[marketId].id != bytes32(0)) revert MarketAlreadyExists();
        _createMarket(marketId, uint64(closesAt));
    }

    /// @dev Shared by the operator path above and the attestation path below.
    ///      Callers are responsible for the MarketAlreadyExists check —
    ///      `_ensureMarketWithAttestation` uses its absence as the "already
    ///      registered, nothing to do" signal instead.
    function _createMarket(bytes32 marketId, uint64 closesAt) internal {
        if (marketId == bytes32(0)) revert MarketNotFound();
        if (closesAt <= block.timestamp) revert InvalidClosesAt();

        markets[marketId] = Market({
            id: marketId,
            status: MarketStatus.Open,
            winningOutcome: 0,
            totalBetAmount: 0,
            totalPayoutRequired: 0,
            closesAt: closesAt,
            fillRatioX1000: 0
        });

        emit MarketCreated(marketId, closesAt);
    }

    /// @notice Permissionlessly registers `attestation.marketId` if it
    ///         doesn't exist yet, provided `attestation.signature` is a valid
    ///         ORACLE_SIGNER_ROLE signature over it. No-op (attestation
    ///         unchecked) if the market is already registered — a
    ///         stale/wrong ticket for a known market simply doesn't matter.
    function _ensureMarketWithAttestation(IBettingCore.MarketAttestation calldata attestation) internal {
        if (markets[attestation.marketId].id != bytes32(0)) return;
        if (attestation.validUntil < block.timestamp) revert AttestationExpired();

        bytes32 structHash = keccak256(
            abi.encode(MARKET_ATTESTATION_TYPEHASH, attestation.marketId, attestation.closesAt, attestation.validUntil)
        );
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), attestation.signature);
        if (!hasRole(ORACLE_SIGNER_ROLE, signer)) revert InvalidOracleSignature();

        _createMarket(attestation.marketId, attestation.closesAt);
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
        return _executeBet(marketId, outcome, amount, oddsX1000, minOddsX1000);
    }

    /// @notice Same as `placeBet`, but registers `marketId` first (via a
    ///         valid ORACLE_SIGNER_ROLE attestation) if it isn't on-chain
    ///         yet — one signature, one transaction, no separate "create
    ///         market" step visible to the bettor. If the market already
    ///         exists, the attestation params are ignored entirely and this
    ///         behaves identically to `placeBet`.
    function placeBetWithAttestation(
        uint8 outcome,
        uint256 amount,
        uint256 oddsX1000,
        uint256 minOddsX1000,
        IBettingCore.MarketAttestation calldata attestation
    ) external override whenNotPaused nonReentrant returns (bytes32 betId) {
        _ensureMarketWithAttestation(attestation);
        return _executeBet(attestation.marketId, outcome, amount, oddsX1000, minOddsX1000);
    }

    /// @dev Shared body for `placeBet`/`placeBetWithAttestation` — identical
    ///      to the pre-attestation `placeBet` implementation.
    function _executeBet(
        bytes32 marketId,
        uint8 outcome,
        uint256 amount,
        uint256 oddsX1000,
        uint256 minOddsX1000
    ) internal returns (bytes32 betId) {
        Market storage m = _market(marketId);
        if (m.status != MarketStatus.Open) revert MarketNotOpen();
        if (block.timestamp >= m.closesAt) revert MarketClosed();
        if (amount < minBet || amount > maxBet) revert BetAmountOutOfRange();
        if (oddsX1000 <= ODDS_DENOM) revert InvalidOdds();
        if (oddsX1000 < minOddsX1000) revert OddsBelowSlippage();

        uint256 potentialPayout = (amount * oddsX1000) / ODDS_DENOM;
        uint256 lockNeeded = _probabilityWeightedLock(potentialPayout - amount, oddsX1000);

        // Lock shared-pool collateral sized to expected loss (deficit ×
        // implied win probability × probabilitySafetyMultiplierBps), not
        // the full worst-case deficit. Skipped entirely if it rounds to
        // zero — mirrors the same ">0" guard voidBet already applies on
        // the unlock side.
        if (lockNeeded > 0) {
            liquidityPool.lockLiquidity(marketId, lockNeeded);
        }

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
            placedAt: uint64(block.timestamp),
            lockedAmount: lockNeeded
        });

        m.totalBetAmount += amount;

        // Pull stake from the bettor — held by BettingCore until settlement.
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit BetPlaced(betId, marketId, msg.sender, outcome, amount, potentialPayout, oddsX1000);
    }

    /// @dev Reservation sized to expected loss rather than worst-case
    ///      deficit: rawDeficit × impliedWinProbability × safety multiplier,
    ///      where impliedWinProbability = ODDS_DENOM / oddsX1000. Folded
    ///      into a single division (rather than computing impliedWinProbability
    ///      as its own intermediate value) so long-shot odds don't truncate
    ///      it to zero before it ever multiplies rawDeficit — e.g. at 1000x
    ///      odds, ODDS_DENOM/oddsX1000 alone would floor to 0.
    function _probabilityWeightedLock(uint256 rawDeficit, uint256 oddsX1000) internal view returns (uint256) {
        uint256 multiplier = probabilitySafetyMultiplierBps == 0 ? BPS_DENOM : probabilitySafetyMultiplierBps;
        return (rawDeficit * ODDS_DENOM * multiplier) / (oddsX1000 * BPS_DENOM);
    }

    // -----------------------------------------------------------------------
    // Market settlement (OPERATOR)
    // -----------------------------------------------------------------------

    /// @notice Settle a market by enumerating every winning bet.
    /// @dev `totalPayoutRequired` MUST equal the sum of `winningBetIds[i].potentialPayout`.
    ///      Winning bets' `potentialPayout` is NOT mutated — the shared
    ///      `fillRatioX1000` stored on the Market struct is applied at
    ///      `claimWinnings` time instead.
    function settleMarket(
        bytes32 marketId,
        uint8 winningOutcome,
        bytes32[] calldata winningBetIds,
        uint256 totalPayoutRequired
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        if (winningBetIds.length > MAX_SETTLE_BATCH) revert TooManyBets();
        Market storage m = _market(marketId);
        if (m.status == MarketStatus.Settled) revert MarketAlreadySettled();
        if (m.status == MarketStatus.Cancelled) revert MarketAlreadyCancelled();

        (uint256 sumStakes, uint256 sumQuoted) = _validateAndSumWinningBets(marketId, winningBetIds);
        if (sumQuoted != totalPayoutRequired) revert PayoutSumMismatch();

        // Mark winners — potentialPayout stays as the original quoted ceiling.
        _markWinningBets(winningBetIds);

        // Winners are funded directly from the shared LiquidityPool's free
        // capacity (see _computeMarketFillRatio) — not netted against this
        // market's own losing stakes first.
        uint256 totalBetAmount = m.totalBetAmount;
        uint256 fillRatio = _computeMarketFillRatio(marketId, sumStakes, sumQuoted);

        m.status = MarketStatus.Settled;
        m.winningOutcome = winningOutcome;
        m.totalPayoutRequired = totalPayoutRequired;
        m.fillRatioX1000 = fillRatio;

        // Compute actual scaled payout for pool/treasury accounting.
        // Algebraically: actualTotalPayout = sumStakes + fillRatio * (sumQuoted - sumStakes) / 1000
        //              = L (when fillRatio < 1000), or sumQuoted (when fillRatio = 1000).
        uint256 profitSpan = sumQuoted - sumStakes;
        uint256 actualTotalPayout = sumStakes + (fillRatio * profitSpan) / 1000;

        uint256 houseEdge = _finalizeMarketAccounting(marketId, totalBetAmount, actualTotalPayout);

        emit MarketSettled(
            marketId,
            winningOutcome,
            totalBetAmount,
            actualTotalPayout,
            houseEdge
        );
    }

    function _validateAndSumWinningBets(bytes32 marketId, bytes32[] calldata winningBetIds)
        internal
        view
        returns (uint256 sumStakes, uint256 sumQuoted)
    {
        uint256 len = winningBetIds.length;
        for (uint256 i = 0; i < len; ++i) {
            bytes32 betId = winningBetIds[i];
            Bet storage b = bets[betId];
            if (b.bettor == address(0)) revert BetNotFound();
            if (b.marketId != marketId) revert BetNotFound();
            if (b.status != BetStatus.Pending) continue;
            sumStakes += b.amount;
            sumQuoted += b.potentialPayout;
        }
    }

    /// @dev Every single-bet winner is funded directly from the shared
    ///      LiquidityPool's free capacity — no netting against this
    ///      market's own losing stakes first (that used to let a
    ///      sufficiently one-sided market skip the pool entirely; it no
    ///      longer does). `houseEdgeBps` — the same admin-set parameter
    ///      `_finalizeMarketAccounting` already takes its cut with on the
    ///      surplus side — is reserved off the pool's capacity before any
    ///      of it is offered to cover winners, so the house keeps a
    ///      consistent margin on pool-funded payouts too, not only on
    ///      markets that net a surplus on their own.
    ///
    ///      deficit   = ΣQ − ΣStakes  (profit owed to winners, above their own stake)
    ///      available = pool's free capacity for this market, less houseEdgeBps
    ///      covered   = min(deficit, available)
    ///      L         = ΣStakes + covered
    ///
    ///      Returns a value in [0, 1000] where 1000 = full quoted payout.
    function _computeMarketFillRatio(
        bytes32 marketId,
        uint256 sumStakes,
        uint256 sumQuoted
    ) internal view returns (uint256) {
        if (sumQuoted == 0 || sumQuoted <= sumStakes) return 1000;

        uint256 deficit = sumQuoted - sumStakes;

        uint256 rawAvailable = address(liquidityPool) != address(0)
            ? liquidityPool.getFreeLiquidity(marketId)
            : 0;
        // houseEdgeBps is hard-capped at 1000 (10%) by setHouseEdge, so this
        // can never underflow — at most 10% of rawAvailable is reserved.
        uint256 available = rawAvailable - (rawAvailable * houseEdgeBps) / BPS_DENOM;
        uint256 covered = deficit < available ? deficit : available;

        uint256 L = sumStakes + covered;

        if (L >= sumQuoted) return 1000;
        if (L <= sumStakes) return 0;
        return ((L - sumStakes) * 1000) / (sumQuoted - sumStakes);
    }

    /// @dev Mark winning bets as Won without mutating potentialPayout.
    ///      Scaling is deferred to `claimWinnings` using `Market.fillRatioX1000`.
    function _markWinningBets(bytes32[] calldata winningBetIds) internal {
        uint256 len = winningBetIds.length;
        for (uint256 i = 0; i < len; ++i) {
            Bet storage b = bets[winningBetIds[i]];
            if (b.status != BetStatus.Pending) continue;
            b.status = BetStatus.Won;
            emit BetSettled(winningBetIds[i], BetStatus.Won);
        }
    }

    function _finalizeMarketAccounting(
        bytes32 marketId,
        uint256 totalBetAmount,
        uint256 actualTotalPayout
    ) internal returns (uint256 houseEdge) {
        if (actualTotalPayout < totalBetAmount) {
            houseEdge = (totalBetAmount * houseEdgeBps) / BPS_DENOM;
            uint256 surplus = totalBetAmount - actualTotalPayout;
            if (surplus < houseEdge) {
                houseEdge = surplus;
            }
            uint256 toPool = surplus - houseEdge;

            if (toPool > 0 && address(liquidityPool) != address(0)) {
                usdc.safeTransfer(address(liquidityPool), toPool);
            }
            if (houseEdge > 0 && treasury != address(0)) {
                usdc.safeTransfer(treasury, houseEdge);
            }
            if (address(liquidityPool) != address(0)) {
                liquidityPool.reportMarketResult(marketId, totalBetAmount, actualTotalPayout);
            }
        } else {
            if (address(liquidityPool) != address(0)) {
                liquidityPool.reportMarketResult(marketId, totalBetAmount, actualTotalPayout);
            }
        }
    }

    /// @notice Void a single pending bet, refunding its stake without
    ///         treating it as won or lost. `settleMarket` only carries one
    ///         winningOutcome per market — it can't represent an outcome
    ///         that's neither a win nor a loss, an Asian handicap push
    ///         being the main case, where the bettor is owed their stake
    ///         back. Must run before `settleMarket` finalizes the market:
    ///         it adjusts `totalBetAmount` the same way `settleMarket`'s own
    ///         house-edge/surplus math relies on, so a voided bet's stake
    ///         isn't double-counted as still available to the pool.
    function voidBet(bytes32 betId) external onlyRole(OPERATOR_ROLE) nonReentrant {
        Bet storage b = bets[betId];
        if (b.bettor == address(0)) revert BetNotFound();
        if (b.status != BetStatus.Pending) revert BetNotRefundable();

        Market storage m = _market(b.marketId);
        if (m.status == MarketStatus.Settled) revert MarketAlreadySettled();
        if (m.status == MarketStatus.Cancelled) revert MarketAlreadyCancelled();

        b.status = BetStatus.Cancelled;
        m.totalBetAmount -= b.amount;

        // Use the amount actually locked at placement time, not a fresh
        // recompute — probabilitySafetyMultiplierBps may have changed since
        // then, and recomputing here could try to unlock more (or less)
        // than this specific bet actually holds in the market's shared lock
        // bucket, corrupting other bets' reservations on the same market.
        uint256 lockedForBet = b.lockedAmount;
        if (lockedForBet > 0) {
            liquidityPool.unlockLiquidity(b.marketId, lockedForBet);
        }

        usdc.safeTransfer(b.bettor, b.amount);
        emit BetVoided(betId, b.bettor, b.amount);
    }

    // -----------------------------------------------------------------------
    // Bettor claims (PUBLIC)
    // -----------------------------------------------------------------------

    /// @inheritdoc IBettingCore
    /// @dev Applies the market's `fillRatioX1000` to scale the payout
    ///      between the bettor's stake floor and the quoted ceiling.
    function claimWinnings(bytes32 betId) external override nonReentrant {
        Bet storage b = bets[betId];
        if (b.bettor == address(0)) revert BetNotFound();
        if (b.bettor != msg.sender) revert NotBetOwner();
        if (b.status != BetStatus.Won) revert BetNotWon();

        b.status = BetStatus.Cashed;

        Market storage m = markets[b.marketId];
        uint256 fillRatio = m.fillRatioX1000;
        // payout = stake + fillRatio × (quotedPayout − stake) / 1000
        uint256 payout = b.amount + (fillRatio * (b.potentialPayout - b.amount)) / 1000;

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
    // Parlays (PUBLIC)
    // -----------------------------------------------------------------------

    /// @notice Place a multi-leg bet across distinct markets. Wins only if
    ///         every leg wins. Backed by the same shared pool as single bets
    ///         — the parlay's own id is used as the pool's per-key
    ///         accounting bucket, exactly like a market's id.
    function placeParlayBet(
        bytes32[] calldata marketIds,
        uint8[] calldata outcomes,
        uint256 stake,
        uint256 combinedOddsX1000,
        uint256 minCombinedOddsX1000
    ) external whenNotPaused nonReentrant returns (bytes32 parlayId) {
        return _executeParlayBet(marketIds, outcomes, stake, combinedOddsX1000, minCombinedOddsX1000);
    }

    /// @notice Same as `placeParlayBet`, but registers any not-yet-created
    ///         leg markets first via per-leg ORACLE_SIGNER_ROLE attestations
    ///         — one signature set, one transaction. `attestations` must be
    ///         the same length as `marketIds`, and `attestations[i].marketId`
    ///         must equal `marketIds[i]`; entries for legs whose market
    ///         already exists are ignored.
    function placeParlayBetWithAttestations(
        bytes32[] calldata marketIds,
        uint8[] calldata outcomes,
        uint256 stake,
        uint256 combinedOddsX1000,
        uint256 minCombinedOddsX1000,
        IBettingCore.MarketAttestation[] calldata attestations
    ) external override whenNotPaused nonReentrant returns (bytes32 parlayId) {
        _ensureParlayMarketsWithAttestations(marketIds, attestations);
        return _executeParlayBet(marketIds, outcomes, stake, combinedOddsX1000, minCombinedOddsX1000);
    }

    /// @dev Split out of `placeParlayBetWithAttestations` to keep its stack
    ///      footprint under the EVM's local-variable limit — same reason
    ///      `_validateParlayLegs`/`_storeParlay` are split out below.
    function _ensureParlayMarketsWithAttestations(
        bytes32[] calldata marketIds,
        IBettingCore.MarketAttestation[] calldata attestations
    ) private {
        uint256 legs = marketIds.length;
        if (legs != attestations.length) revert LegCountMismatch();
        for (uint256 i = 0; i < legs; ++i) {
            if (attestations[i].marketId != marketIds[i]) revert MarketNotFound();
            _ensureMarketWithAttestation(attestations[i]);
        }
    }

    /// @dev Shared body for `placeParlayBet`/`placeParlayBetWithAttestations`
    ///      — identical to the pre-attestation `placeParlayBet` implementation.
    function _executeParlayBet(
        bytes32[] calldata marketIds,
        uint8[] calldata outcomes,
        uint256 stake,
        uint256 combinedOddsX1000,
        uint256 minCombinedOddsX1000
    ) internal returns (bytes32 parlayId) {
        if (stake < minBet || stake > maxBet) revert BetAmountOutOfRange();
        if (combinedOddsX1000 <= ODDS_DENOM) revert InvalidOdds();
        if (combinedOddsX1000 < minCombinedOddsX1000) revert OddsBelowSlippage();
        _validateParlayLegs(marketIds, outcomes);

        uint256 potentialPayout = (stake * combinedOddsX1000) / ODDS_DENOM;

        uint256 nonce = nextParlayNonce[msg.sender]++;
        parlayId = keccak256(abi.encodePacked("PARLAY", msg.sender, nonce));

        // Lock shared-pool collateral sized to expected loss, exactly like a
        // single bet (see _probabilityWeightedLock) — keyed by the parlay's
        // own id. No per-parlay lockedAmount bookkeeping needed the way
        // single bets need it for voidBet: every unlock path for a parlay
        // (claimParlayWinnings/claimParlayRefund/reportParlayLoss) reports
        // through LiquidityPool.reportMarketResult, which releases whatever
        // is actually in this parlay's own bucket rather than trusting a
        // BettingCore-supplied amount.
        uint256 lockNeeded = _probabilityWeightedLock(potentialPayout - stake, combinedOddsX1000);
        if (lockNeeded > 0) {
            liquidityPool.lockLiquidity(parlayId, lockNeeded);
        }

        _storeParlay(parlayId, marketIds, outcomes, stake, potentialPayout, combinedOddsX1000);

        usdc.safeTransferFrom(msg.sender, address(this), stake);

        emit ParlayPlaced(parlayId, msg.sender, marketIds, outcomes, stake, potentialPayout, combinedOddsX1000);
    }

    /// @dev Split out of `placeParlayBet` to keep its stack footprint under
    ///      the EVM's local-variable limit. Every leg must be a real, open,
    ///      not-yet-closed market, and no market may appear twice. O(legs^2)
    ///      but legs is capped at MAX_PARLAY_LEGS, so this is cheap.
    function _validateParlayLegs(bytes32[] calldata marketIds, uint8[] calldata outcomes) private view {
        uint256 legs = marketIds.length;
        if (legs < MIN_PARLAY_LEGS) revert TooFewLegs();
        if (legs > MAX_PARLAY_LEGS) revert TooManyLegs();
        if (legs != outcomes.length) revert LegCountMismatch();

        for (uint256 i = 0; i < legs; ++i) {
            Market storage m = _market(marketIds[i]);
            if (m.status != MarketStatus.Open) revert MarketNotOpen();
            if (block.timestamp >= m.closesAt) revert MarketClosed();
            for (uint256 j = i + 1; j < legs; ++j) {
                if (marketIds[i] == marketIds[j]) revert DuplicateMarketInParlay();
            }
        }
    }

    /// @dev Split out of `placeParlayBet` for the same stack-depth reason.
    function _storeParlay(
        bytes32 parlayId,
        bytes32[] calldata marketIds,
        uint8[] calldata outcomes,
        uint256 stake,
        uint256 potentialPayout,
        uint256 combinedOddsX1000
    ) private {
        Parlay storage p = _parlays[parlayId];
        p.bettor = msg.sender;
        p.marketIds = marketIds;
        p.outcomes = outcomes;
        p.stake = stake;
        p.potentialPayout = potentialPayout;
        p.status = BetStatus.Pending;
        p.combinedOddsX1000 = combinedOddsX1000;
        p.placedAt = uint64(block.timestamp);
    }

    /// @notice Claim a won parlay. Eligibility is fully computable from
    ///         already-settled markets — unlike single bets, there's no
    ///         operator settlement step to wait on beyond the constituent
    ///         markets themselves resolving.
    /// @dev Casino-style single-bet scaling: checks LiquidityPool's free
    ///      capacity against the parlay's quoted payout at claim time,
    ///      scaling between stake and quoted if the pool is short.
    function claimParlayWinnings(bytes32 parlayId) external nonReentrant {
        Parlay storage p = _parlays[parlayId];
        if (p.bettor == address(0)) revert ParlayNotFound();
        if (p.bettor != msg.sender) revert NotParlayOwner();
        if (p.status != BetStatus.Pending) revert ParlayAlreadyResolved();

        LegVerdict verdict = _evaluateParlay(parlayId);
        if (verdict == LegVerdict.Pending) revert ParlayNotReady();
        if (verdict != LegVerdict.Won) revert ParlayNotWon();

        p.status = BetStatus.Won;
        uint256 quoted = p.potentialPayout;
        uint256 stake = p.stake;

        // Pool covers deficit (quoted - stake), minus houseEdgeBps reserved
        // off its capacity first — same margin single bets take in
        // _computeMarketFillRatio, and same overflow-safety reasoning
        // (houseEdgeBps capped at 1000 by setHouseEdge).
        uint256 deficit = quoted - stake;
        uint256 rawAvailable = liquidityPool.getFreeLiquidity(parlayId);
        uint256 available = rawAvailable - (rawAvailable * houseEdgeBps) / BPS_DENOM;
        uint256 covered = deficit < available ? deficit : available;
        uint256 payout = stake + covered;

        liquidityPool.reportMarketResult(parlayId, stake, payout);
        usdc.safeTransfer(msg.sender, payout);

        emit ParlayWon(parlayId, msg.sender, payout);
    }

    /// @notice Claim a refund on a parlay voided by a cancelled leg — as
    ///         long as no other leg has already definitively lost (a lost
    ///         leg makes the whole parlay Lost regardless of a later
    ///         cancellation elsewhere).
    function claimParlayRefund(bytes32 parlayId) external nonReentrant {
        Parlay storage p = _parlays[parlayId];
        if (p.bettor == address(0)) revert ParlayNotFound();
        if (p.bettor != msg.sender) revert NotParlayOwner();
        if (p.status != BetStatus.Pending) revert ParlayAlreadyResolved();

        LegVerdict verdict = _evaluateParlay(parlayId);
        if (verdict != LegVerdict.Void) revert ParlayNotVoid();

        p.status = BetStatus.Cancelled;
        uint256 amount = p.stake;

        // Net-zero reconciliation — releases the lock, moves nothing,
        // bettor is refunded 1:1 from BettingCore's own balance. Same
        // pattern `cancelMarket` uses for single bets.
        liquidityPool.reportMarketResult(parlayId, amount, amount);
        usdc.safeTransfer(msg.sender, amount);

        emit ParlayRefunded(parlayId, msg.sender, amount);
    }

    /// @notice Permissionlessly reconcile a lost parlay: releases its pool
    ///         lock and moves the stake to the pool (minus house edge) as
    ///         profit. Nobody is naturally incentivized to call this for a
    ///         bet they know they lost, so it has no owner check — anyone
    ///         (a keeper, the settlement worker, or the UI when a bettor
    ///         views a losing parlay) can trigger it. Until it's called,
    ///         the parlay's lock sits idle but no funds are at risk.
    function reportParlayLoss(bytes32 parlayId) external nonReentrant {
        Parlay storage p = _parlays[parlayId];
        if (p.bettor == address(0)) revert ParlayNotFound();
        if (p.status != BetStatus.Pending) revert ParlayAlreadyResolved();

        LegVerdict verdict = _evaluateParlay(parlayId);
        if (verdict != LegVerdict.Lost) revert ParlayNotLost();

        p.status = BetStatus.Lost;
        uint256 stake = p.stake;

        // Same house-edge split as a single market the pool wins.
        uint256 houseEdge = (stake * houseEdgeBps) / BPS_DENOM;
        uint256 toPool = stake - houseEdge;

        if (toPool > 0) {
            usdc.safeTransfer(address(liquidityPool), toPool);
        }
        if (houseEdge > 0) {
            usdc.safeTransfer(treasury, houseEdge);
        }
        liquidityPool.reportMarketResult(parlayId, stake, 0);

        emit ParlayLost(parlayId, p.bettor, stake, houseEdge);
    }

    // -----------------------------------------------------------------------
    // Parlay views
    // -----------------------------------------------------------------------

    /// @notice Full parlay record, including its leg arrays (the auto
    ///         getter for a mapping-of-struct silently drops dynamic array
    ///         members, so this is the only way to read `marketIds`/`outcomes`).
    function getParlay(bytes32 parlayId) external view returns (Parlay memory) {
        Parlay storage p = _parlays[parlayId];
        if (p.bettor == address(0)) revert ParlayNotFound();
        return p;
    }

    /// @notice Current computed verdict for a parlay, without mutating
    ///         state — lets the backend/UI distinguish "still pending" from
    ///         "lost but not yet reconciled" without submitting a tx.
    function getParlayVerdict(bytes32 parlayId) external view returns (LegVerdict) {
        if (_parlays[parlayId].bettor == address(0)) revert ParlayNotFound();
        return _evaluateParlay(parlayId);
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

        // Treat as a zero-net-result settlement to release the market's lock
        // without moving any surplus/deficit — bettors are refunded 1:1.
        liquidityPool.reportMarketResult(marketId, m.totalBetAmount, m.totalBetAmount);

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

    /// @notice Update the placement-time reservation safety multiplier.
    ///         Floor 10000 (1.0x, pure expected value — never reserve less
    ///         than the actuarially fair amount); cap 100000 (10x) to catch
    ///         fat-finger input while still allowing a very conservative
    ///         posture if desired.
    function setProbabilitySafetyMultiplier(uint256 newBps) external onlyRole(ADMIN_ROLE) {
        if (newBps < BPS_DENOM || newBps > 100_000) revert InvalidProbabilitySafetyMultiplier();
        uint256 old = probabilitySafetyMultiplierBps;
        probabilitySafetyMultiplierBps = newBps;
        emit ProbabilitySafetyMultiplierUpdated(old, newBps);
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

    /// @notice Repoint this contract at a different shared liquidity pool.
    function setLiquidityPool(address newLiquidityPool) external onlyRole(ADMIN_ROLE) {
        if (newLiquidityPool == address(0)) revert InvalidLiquidityPool();
        liquidityPool = ILiquidityPool(newLiquidityPool);
        emit LiquidityPoolUpdated(newLiquidityPool);
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    function _market(bytes32 marketId) internal view returns (Market storage m) {
        m = markets[marketId];
        if (m.id == bytes32(0)) revert MarketNotFound();
    }

    /// @dev Single-pass verdict over a parlay's legs. A definitively-lost
    ///      leg always wins over a later cancellation — once one leg is
    ///      confirmed lost the parlay is Lost regardless of what happens to
    ///      any other leg afterward.
    function _evaluateParlay(bytes32 parlayId) internal view returns (LegVerdict) {
        Parlay storage p = _parlays[parlayId];
        uint256 legs = p.marketIds.length;
        bool anyVoid = false;

        for (uint256 i = 0; i < legs; ++i) {
            Market storage m = markets[p.marketIds[i]];
            if (m.status == MarketStatus.Cancelled) {
                anyVoid = true;
                continue;
            }
            if (m.status != MarketStatus.Settled) {
                return LegVerdict.Pending;
            }
            if (m.winningOutcome != p.outcomes[i]) {
                return LegVerdict.Lost;
            }
        }

        if (anyVoid) return LegVerdict.Void;
        return LegVerdict.Won;
    }

    // -----------------------------------------------------------------------
    // UUPS
    // -----------------------------------------------------------------------

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
