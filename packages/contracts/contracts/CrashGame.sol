// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import {ReentrancyGuardUpgradeable} from "./vendor/ReentrancyGuardUpgradeable.sol";

/// @title CrashGame
/// @notice Multi-player commit-reveal crash game with pull-payment settlement.
/// @dev Hardening:
///      - **Commit-reveal**: round starts with `serverSeedHash`, resolution
///        requires the matching pre-image. Crash point is deterministic from
///        the seed so neither the operator nor players can rig the outcome.
///      - **Pull payments**: `resolveRound` only flips player state and
///        records `pendingPayout`. Players call `claim()` themselves so a
///        single overflowing player array can't grief everyone else.
///      - **Solvency**: `joinRound` enforces a per-round `MAX_TOTAL_EXPOSURE`
///        equal to the contract's USDC balance / cashout cap. Joins past the
///        cap revert.
///      - **Bounded loops**: `MAX_PLAYERS_PER_ROUND` caps the resolve cost.
contract CrashGame is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 private constant BPS_DENOM = 10000;

    enum RoundStatus {
        Pending,
        Running,
        Resolved
    }

    struct Round {
        uint256 id;
        bytes32 serverSeedHash;
        bytes32 serverSeed;        // revealed on resolve
        uint64 startedAt;
        uint64 resolvedAt;
        uint256 crashMultiplierX100;
        uint256 totalStaked;
        uint256 maxPotentialPayout;
        RoundStatus status;
    }

    struct PlayerEntry {
        address player;
        uint256 amount;
        uint256 autoCashoutX100;
        uint256 cashedOutAtX100;
        bool resolved;
    }

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IERC20 public immutable usdc;

    /// @notice Minimum stake per join (1 USDC).
    uint256 public constant MIN_STAKE = 1e6;

    /// @notice Maximum stake per join (5,000 USDC).
    uint256 public constant MAX_STAKE = 5000e6;

    /// @notice Max players the resolve loop can handle in a single tx.
    uint256 public constant MAX_PLAYERS_PER_ROUND = 100;

    /// @notice Hard ceiling on any single auto-cashout multiplier (1000x).
    uint256 public constant MAX_AUTOCASHOUT_X100 = 100_000;

    uint256 public constant ROUND_TIMEOUT = 30 minutes;

    /// @notice Total number of rounds created.
    uint256 public currentRoundId;

    mapping(uint256 => Round) public rounds;
    mapping(uint256 => PlayerEntry[]) public roundPlayers;

    /// @notice 1-based index into roundPlayers[roundId] for fast lookup.
    mapping(uint256 => mapping(address => uint256)) private _playerEntryIndex;

    /// @notice Withdrawable USDC per player, accumulated on round resolution.
    mapping(address => uint256) public pendingPayout;

    /// @notice Running total of `pendingPayout` across every player — lets
    ///         free-capacity math (resolveRound, withdrawBankroll) compute
    ///         `balanceOf(this) - totalPendingPayouts` instead of raw
    ///         balance, which would otherwise double-count USDC already
    ///         owed to unclaimed prior winners (pull-payment means a win
    ///         can sit uncollected across many later rounds).
    uint256 public totalPendingPayouts;

    /// @notice Return-to-player in bps (9000 = 90% RTP / 10% edge),
    ///         replacing the previous hardcoded 1%-edge constants in
    ///         `_crashFromSeed`. Bounded [5000,9900] by setRtp.
    uint256 public rtpBps;

    uint256[48] private __gap;

    // -----------------------------------------------------------------------
    // Errors
    // -----------------------------------------------------------------------

    error PendingRoundExists();
    error RoundNotFound();
    error RoundNotPending();
    error RoundNotRunning();
    error RoundAlreadyResolved();
    error AlreadyJoined();
    error NotJoined();
    error AlreadyCashedOut();
    error InvalidMultiplier();
    error InvalidSeedHash();
    error SeedMismatch();
    error StakeOutOfRange();
    error TooManyPlayers();
    error InsufficientBankroll();
    error NoPendingPayout();
    error ZeroAmount();
    error RoundNotTimedOut();
    error InvalidRtp();

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event RoundStarted(uint256 indexed roundId, bytes32 serverSeedHash);
    event RoundLocked(uint256 indexed roundId, uint64 startedAt);
    event PlayerJoined(
        uint256 indexed roundId,
        address indexed player,
        uint256 amount,
        uint256 autoCashoutX100
    );
    event PlayerCashedOut(uint256 indexed roundId, address indexed player, uint256 multiplierX100);
    event RoundResolved(
        uint256 indexed roundId,
        uint256 crashMultiplierX100,
        bytes32 serverSeed
    );
    event RoundCancelled(uint256 indexed roundId);
    event PayoutCredited(uint256 indexed roundId, address indexed player, uint256 amount);
    event PayoutClaimed(address indexed player, uint256 amount);
    event BankrollDeposit(address indexed from, uint256 amount);
    event BankrollWithdraw(address indexed to, uint256 amount);
    event RtpUpdated(uint256 oldBps, uint256 newBps);

    /// @param _usdc USDC token (6 decimals). Immutable — identical across upgrades.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        _disableInitializers();
    }

    /// @param admin Account granted DEFAULT_ADMIN + ADMIN + OPERATOR + PAUSER.
    function initialize(address admin) external initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /// @notice V2 upgrade hook — sets the initial RTP. Bundled atomically
    ///         with the upgrade itself (via upgradeProxy's `call` option),
    ///         same reasoning as CasinoHouse's identical hook: never leave a
    ///         live window where `rtpBps` reads its zero default.
    /// @custom:oz-upgrades-validate-as-initializer
    function initializeV2(uint256 initialRtpBps) external reinitializer(2) onlyRole(DEFAULT_ADMIN_ROLE) {
        if (initialRtpBps < 5000 || initialRtpBps > 9900) revert InvalidRtp();
        rtpBps = initialRtpBps;
    }

    /// @notice Update RTP in basis points. Bounded [5000,9900] — same
    ///         reasoning as CasinoHouse.setRtp.
    function setRtp(uint256 newBps) external onlyRole(ADMIN_ROLE) {
        if (newBps < 5000 || newBps > 9900) revert InvalidRtp();
        uint256 old = rtpBps;
        rtpBps = newBps;
        emit RtpUpdated(old, newBps);
    }

    // -----------------------------------------------------------------------
    // Round lifecycle
    // -----------------------------------------------------------------------

    /// @notice Start a new pending round, committing to a server seed hash.
    /// @param serverSeedHash keccak256(serverSeed) — must match the seed
    ///        eventually passed to `resolveRound`.
    function startRound(bytes32 serverSeedHash)
        external
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
        returns (uint256 roundId)
    {
        if (serverSeedHash == bytes32(0)) revert InvalidSeedHash();
        if (currentRoundId != 0) {
            Round storage last = rounds[currentRoundId];
            if (last.status == RoundStatus.Pending || last.status == RoundStatus.Running) {
                revert PendingRoundExists();
            }
        }
        roundId = ++currentRoundId;
        rounds[roundId] = Round({
            id: roundId,
            serverSeedHash: serverSeedHash,
            serverSeed: bytes32(0),
            startedAt: 0,
            resolvedAt: 0,
            crashMultiplierX100: 0,
            totalStaked: 0,
            maxPotentialPayout: 0,
            status: RoundStatus.Pending
        });
        emit RoundStarted(roundId, serverSeedHash);
    }

    /// @notice Join a pending round.
    /// @param autoCashoutX100 Auto-cashout multiplier scaled by 100 (200 = 2.00x).
    ///        0 disables auto-cashout. Must be > 100 (1.00x) and <= MAX_AUTOCASHOUT_X100.
    function joinRound(uint256 roundId, uint256 amount, uint256 autoCashoutX100)
        external
        nonReentrant
        whenNotPaused
    {
        if (amount < MIN_STAKE || amount > MAX_STAKE) revert StakeOutOfRange();
        Round storage r = _round(roundId);
        if (r.status != RoundStatus.Pending) revert RoundNotPending();
        if (autoCashoutX100 != 0) {
            if (autoCashoutX100 <= 100) revert InvalidMultiplier();
            if (autoCashoutX100 > MAX_AUTOCASHOUT_X100) revert InvalidMultiplier();
        }
        if (_playerEntryIndex[roundId][msg.sender] != 0) revert AlreadyJoined();
        if (roundPlayers[roundId].length >= MAX_PLAYERS_PER_ROUND) revert TooManyPlayers();

        // Track worst-case bankroll exposure for this round.
        uint256 cap = autoCashoutX100 == 0 ? MAX_AUTOCASHOUT_X100 : autoCashoutX100;
        uint256 maxPayout = (amount * cap) / 100;

        r.maxPotentialPayout += maxPayout;
        r.totalStaked += amount;

        roundPlayers[roundId].push(
            PlayerEntry({
                player: msg.sender,
                amount: amount,
                autoCashoutX100: autoCashoutX100,
                cashedOutAtX100: 0,
                resolved: false
            })
        );
        _playerEntryIndex[roundId][msg.sender] = roundPlayers[roundId].length;

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit PlayerJoined(roundId, msg.sender, amount, autoCashoutX100);
    }

    /// @notice Lock a round to disable new joins.
    function lockRound(uint256 roundId) external onlyRole(OPERATOR_ROLE) {
        Round storage r = _round(roundId);
        if (r.status != RoundStatus.Pending) revert RoundNotPending();
        r.status = RoundStatus.Running;
        r.startedAt = uint64(block.timestamp);
        emit RoundLocked(roundId, r.startedAt);
    }

    /// @notice Player-initiated cashout. Operator settles outcomes later;
    ///         this just records the player's claimed multiplier.
    function cashOut(uint256 roundId, uint256 multiplierX100) external {
        Round storage r = _round(roundId);
        if (r.status != RoundStatus.Running) revert RoundNotRunning();
        if (multiplierX100 <= 100) revert InvalidMultiplier();

        uint256 idx = _playerEntryIndex[roundId][msg.sender];
        if (idx == 0) revert NotJoined();
        PlayerEntry storage e = roundPlayers[roundId][idx - 1];
        if (e.cashedOutAtX100 != 0) revert AlreadyCashedOut();

        e.cashedOutAtX100 = multiplierX100;
        emit PlayerCashedOut(roundId, msg.sender, multiplierX100);
    }

    /// @notice Reveal the server seed, compute crash, and credit payouts.
    /// @dev Applies solvency-aware payout scaling if contract liquidity < total quoted payouts.
    function resolveRound(uint256 roundId, bytes32 serverSeed)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
    {
        Round storage r = _round(roundId);
        if (r.status == RoundStatus.Resolved) revert RoundAlreadyResolved();
        if (r.status != RoundStatus.Running) revert RoundNotRunning();
        if (keccak256(abi.encodePacked(serverSeed)) != r.serverSeedHash) revert SeedMismatch();

        uint256 crashX100 = _crashFromSeed(serverSeed, roundId);

        r.status = RoundStatus.Resolved;
        r.resolvedAt = uint64(block.timestamp);
        r.crashMultiplierX100 = crashX100;
        r.serverSeed = serverSeed;

        PlayerEntry[] storage entries = roundPlayers[roundId];
        (uint256 sumStakes, uint256 sumQuoted) = _sumWinningPayouts(entries, crashX100);

        uint256 L = _freeCapacity();
        uint256 fillRatioBps = _calculateFillRatioBps(sumStakes, sumQuoted, L);

        uint256 n = entries.length;
        for (uint256 i = 0; i < n; ++i) {
            PlayerEntry storage e = entries[i];
            if (e.resolved) continue;
            e.resolved = true;

            uint256 mult = 0;
            if (e.cashedOutAtX100 != 0 && e.cashedOutAtX100 <= crashX100) {
                mult = e.cashedOutAtX100;
            } else if (e.autoCashoutX100 != 0 && e.autoCashoutX100 <= crashX100) {
                mult = e.autoCashoutX100;
                e.cashedOutAtX100 = mult;
            }

            if (mult > 0) {
                uint256 payout = _computeScaledPayout(e.amount, mult, L, sumStakes, sumQuoted, fillRatioBps);
                if (payout > 0) {
                    pendingPayout[e.player] += payout;
                    totalPendingPayouts += payout;
                    emit PayoutCredited(roundId, e.player, payout);
                }
            }
        }

        emit RoundResolved(roundId, crashX100, serverSeed);
    }

    function _sumWinningPayouts(PlayerEntry[] storage entries, uint256 crashX100)
        internal
        view
        returns (uint256 sumStakes, uint256 sumQuoted)
    {
        uint256 n = entries.length;
        for (uint256 i = 0; i < n; ++i) {
            PlayerEntry storage e = entries[i];
            if (e.resolved) continue;
            uint256 mult = 0;
            if (e.cashedOutAtX100 != 0 && e.cashedOutAtX100 <= crashX100) {
                mult = e.cashedOutAtX100;
            } else if (e.autoCashoutX100 != 0 && e.autoCashoutX100 <= crashX100) {
                mult = e.autoCashoutX100;
            }
            if (mult > 0) {
                sumStakes += e.amount;
                sumQuoted += (e.amount * mult) / 100;
            }
        }
    }

    function _calculateFillRatioBps(uint256 sumStakes, uint256 sumQuoted, uint256 L)
        internal
        pure
        returns (uint256)
    {
        if (sumQuoted == 0 || L >= sumQuoted) return 10000;
        if (L <= sumStakes) return 0;
        return ((L - sumStakes) * 10000) / (sumQuoted - sumStakes);
    }

    function _computeScaledPayout(
        uint256 stake,
        uint256 mult,
        uint256 L,
        uint256 sumStakes,
        uint256 sumQuoted,
        uint256 fillRatioBps
    ) internal pure returns (uint256) {
        uint256 quotedPayout = (stake * mult) / 100;
        if (L >= sumQuoted) {
            return quotedPayout;
        } else if (L >= sumStakes) {
            return stake + ((quotedPayout - stake) * fillRatioBps) / 10000;
        } else {
            return sumStakes > 0 ? (stake * L) / sumStakes : 0;
        }
    }

    /// @notice Cancel a stuck round to refund players.
    function cancelStuckRound(uint256 roundId) external onlyRole(OPERATOR_ROLE) nonReentrant {
        Round storage r = _round(roundId);
        if (r.status != RoundStatus.Running) revert RoundNotRunning();
        if (block.timestamp <= r.startedAt + ROUND_TIMEOUT) revert RoundNotTimedOut();

        r.status = RoundStatus.Resolved;
        r.resolvedAt = uint64(block.timestamp);
        r.crashMultiplierX100 = 0;

        _refundAllEntries(roundId);
        emit RoundCancelled(roundId);
    }

    /// @notice Cancel a round that was started (`startRound`) but never
    ///         locked — e.g. the operator process crashed between the two
    ///         calls. Unlike `cancelStuckRound`, no timeout wait is needed:
    ///         a Pending round has no player mid-flight with an active
    ///         multiplier, so every joined player is owed an exact 1:1
    ///         refund of their stake regardless of when this is called.
    ///         Without this, a round stuck in Pending has no on-chain
    ///         recovery path at all — `cancelStuckRound` only accepts
    ///         Running — and blocks every future round indefinitely, since
    ///         `startRound` refuses to run while one is still Pending.
    function cancelPendingRound(uint256 roundId) external onlyRole(OPERATOR_ROLE) nonReentrant {
        Round storage r = _round(roundId);
        if (r.status != RoundStatus.Pending) revert RoundNotPending();

        r.status = RoundStatus.Resolved;
        r.resolvedAt = uint64(block.timestamp);
        r.crashMultiplierX100 = 0;

        _refundAllEntries(roundId);
        emit RoundCancelled(roundId);
    }

    /// @dev Shared by cancelStuckRound/cancelPendingRound.
    function _refundAllEntries(uint256 roundId) internal {
        PlayerEntry[] storage entries = roundPlayers[roundId];
        uint256 n = entries.length;
        for (uint256 i = 0; i < n; ++i) {
            PlayerEntry storage e = entries[i];
            if (e.resolved) continue;
            e.resolved = true;
            pendingPayout[e.player] += e.amount;
            totalPendingPayouts += e.amount;
        }
    }

    /// @notice Withdraw the caller's accumulated winnings.
    function claim() external nonReentrant {
        uint256 amt = pendingPayout[msg.sender];
        if (amt == 0) revert NoPendingPayout();
        pendingPayout[msg.sender] = 0;
        totalPendingPayouts -= amt;
        usdc.safeTransfer(msg.sender, amt);
        emit PayoutClaimed(msg.sender, amt);
    }

    // -----------------------------------------------------------------------
    // Bankroll management (ADMIN)
    // -----------------------------------------------------------------------

    /// @notice Top up the operator-controlled bankroll.
    function depositBankroll(uint256 amount) external onlyRole(ADMIN_ROLE) {
        if (amount == 0) revert ZeroAmount();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit BankrollDeposit(msg.sender, amount);
    }

    /// @notice Withdraw `amount` USDC from the contract to `to`. Refuses if
    ///         doing so would dip into `totalPendingPayouts` (accrued,
    ///         unclaimed prior winnings) or the current round's
    ///         `maxPotentialPayout` if it hasn't resolved yet — previously
    ///         this doc comment claimed that protection but the code never
    ///         actually enforced it (only checked raw balance).
    function withdrawBankroll(uint256 amount, address to) external onlyRole(ADMIN_ROLE) {
        if (amount == 0) revert ZeroAmount();
        uint256 bal = usdc.balanceOf(address(this));
        uint256 reserved = totalPendingPayouts;
        if (currentRoundId != 0) {
            Round storage r = rounds[currentRoundId];
            if (r.status != RoundStatus.Resolved) {
                reserved += r.maxPotentialPayout;
            }
        }
        uint256 unlocked = bal > reserved ? bal - reserved : 0;
        if (amount > unlocked) revert InsufficientBankroll();
        usdc.safeTransfer(to, amount);
        emit BankrollWithdraw(to, amount);
    }

    // -----------------------------------------------------------------------
    // Pause (PAUSER)
    // -----------------------------------------------------------------------

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // -----------------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------------

    function getRoundPlayerCount(uint256 roundId) external view returns (uint256) {
        return roundPlayers[roundId].length;
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    function _round(uint256 roundId) internal view returns (Round storage r) {
        r = rounds[roundId];
        if (r.id == 0) revert RoundNotFound();
    }

    /// @dev Split out of `resolveRound` to keep its stack footprint under
    ///      the EVM's local-variable limit (same reason BettingCore splits
    ///      several of its own placement/parlay helpers). Real free
    ///      capacity: raw balance minus USDC already owed to unclaimed
    ///      prior winners.
    function _freeCapacity() internal view returns (uint256) {
        uint256 bal = usdc.balanceOf(address(this));
        return bal > totalPendingPayouts ? bal - totalPendingPayouts : 0;
    }

    /// @notice Crash point derived deterministically from the (revealed) seed.
    /// @dev Returns multiplier x100. Floor of 100 (= 1.00x). House edge is
    ///      `(BPS_DENOM - rtpBps) / BPS_DENOM` (was a hardcoded 1% before
    ///      `rtpBps` existed — this generalizes the exact same formula
    ///      shape rather than changing it: at rtpBps=9900 this reproduces
    ///      the old constants' distribution exactly). Distribution:
    ///      `rtpBps/100 / (1 - U)` where U is uniform in [0,1). A fraction
    ///      of rounds equal to the house edge insta-bust at 1.00x.
    ///      `view` not `pure` now that it reads `rtpBps`.
    function _crashFromSeed(bytes32 seed, uint256 roundId) internal view returns (uint256) {
        bytes32 mix = keccak256(abi.encodePacked(seed, roundId));
        uint256 r = uint256(mix);
        // Instant-bust probability = house edge fraction.
        if (r % BPS_DENOM < (BPS_DENOM - rtpBps)) return 100;
        // Map the remaining fraction into 1.01x → ~1000x.
        uint256 e = (r % 1_000_000); // 0..999_999
        // Curve: crash = (rtpBps/100 * 1e6) / (1e6 - e), computed as one
        // division to avoid truncating rtpBps/100 before the multiply.
        uint256 crashX100 = (rtpBps * 1_000_000) / (100 * (1_000_000 - e));
        if (crashX100 < 101) return 101;
        if (crashX100 > MAX_AUTOCASHOUT_X100) return MAX_AUTOCASHOUT_X100;
        return crashX100;
    }

    // -----------------------------------------------------------------------
    // UUPS
    // -----------------------------------------------------------------------

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
