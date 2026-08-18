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
        /// @notice Highest crash multiplier (x100) this round's bankroll can
        ///         fully sustain given every joined player's worst-case
        ///         exposure, computed once at `lockRound` and applied as a
        ///         ceiling in `resolveRound`. Pre-hoc solvency: the crash
        ///         point itself never implies a payout the pool can't
        ///         actually honor, instead of computing an unconstrained
        ///         crash point and scaling winners' payouts down after the
        ///         fact. See `_computeMaxSustainableCrashX100`.
        uint256 maxSustainableCrashX100;
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
    event RoundLocked(uint256 indexed roundId, uint64 startedAt, uint256 maxSustainableCrashX100);
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
            status: RoundStatus.Pending,
            maxSustainableCrashX100: 0
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

    /// @notice Lock a round to disable new joins, and compute the highest
    ///         crash multiplier this round's bankroll can fully sustain
    ///         given every joined player's worst-case exposure. The
    ///         participant set is final the moment this runs (no more
    ///         joins possible past Pending), so this is the right, and
    ///         only, point to compute it — `resolveRound` just applies the
    ///         cap already decided here.
    function lockRound(uint256 roundId) external onlyRole(OPERATOR_ROLE) {
        Round storage r = _round(roundId);
        if (r.status != RoundStatus.Pending) revert RoundNotPending();
        r.status = RoundStatus.Running;
        r.startedAt = uint64(block.timestamp);

        uint256 rawBal = usdc.balanceOf(address(this));
        uint256 available = rawBal > totalPendingPayouts ? rawBal - totalPendingPayouts : 0;
        // Reserve the same edge fraction off capacity that rtpBps already
        // takes on the expected-value side — one consistent margin
        // regardless of which side of the round the house is protecting,
        // same reasoning BettingCore's houseEdgeBps reuse used.
        available = (available * rtpBps) / BPS_DENOM;

        r.maxSustainableCrashX100 = _computeMaxSustainableCrashX100(roundId, available);

        emit RoundLocked(roundId, r.startedAt, r.maxSustainableCrashX100);
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

        // Solvency-bounded by construction: the crash point that actually
        // gets used — revealed, displayed, and determines every winner — is
        // never allowed to exceed what lockRound already confirmed the
        // bankroll can fully sustain. This is the single source of truth
        // for the round from here on; there's no separate "natural" value
        // shown anywhere else it could ever disagree with.
        //
        // maxSustainableCrashX100 == 0 means this round was locked before
        // this cap existed (an in-flight round straddling the upgrade that
        // added it) — fall back to fully uncapped, relying on the
        // pre-existing post-hoc fill-ratio scaling below exactly as before,
        // rather than wrongly clamping a legitimate round to zero.
        PlayerEntry[] storage entries = roundPlayers[roundId];
        uint256 crashX100 = _crashFromSeed(serverSeed, roundId, entries.length == 0);
        if (r.maxSustainableCrashX100 != 0 && crashX100 > r.maxSustainableCrashX100) {
            crashX100 = r.maxSustainableCrashX100;
        }

        r.status = RoundStatus.Resolved;
        r.resolvedAt = uint64(block.timestamp);
        r.crashMultiplierX100 = crashX100;
        r.serverSeed = serverSeed;

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

    /// @dev Largest crash multiplier (x100) this round's bankroll can fully
    ///      sustain, given every joined player's worst-case exposure —
    ///      called once, at `lockRound`, when the participant set is final.
    ///
    ///      Worst-case liability at a candidate ceiling X is NOT linear in
    ///      X the way a naive `available/maxPotentialPayout` ratio would
    ///      assume: an auto-cashout player's contribution is a step
    ///      function (zero until crash reaches their threshold, then a
    ///      FIXED amount that never grows further — a $100k stake at 2x
    ///      auto-cashout realizes its full payout the instant crash hits
    ///      2x, not smeared proportionally out to 1000x). A manual (no
    ///      auto-cashout) player's worst case genuinely does grow linearly
    ///      with X, since they could click cash-out at literally any point
    ///      up to the candidate ceiling.
    ///
    ///      So liability(X) is piecewise-linear and non-decreasing: FLAT
    ///      between consecutive auto-cashout thresholds (only the manual
    ///      stakes' linear term moves it), and JUMPS UP by a fixed amount
    ///      exactly at each threshold. This sorts thresholds ascending and
    ///      walks the segments between them, solving directly for the
    ///      crossing point within whichever segment contains it — an
    ///      all-manual round (the common "everyone plays by hand" case)
    ///      still gets a real, non-trivial cap instead of collapsing to the
    ///      floor for lack of any auto-cashout "breakpoints" to test.
    function _computeMaxSustainableCrashX100(uint256 roundId, uint256 available)
        internal
        view
        returns (uint256)
    {
        PlayerEntry[] storage entries = roundPlayers[roundId];
        uint256 n = entries.length;
        if (n == 0) return MAX_AUTOCASHOUT_X100;

        uint256 manualStakeSum = 0;
        uint256[] memory thresholds = new uint256[](n);
        uint256[] memory stakes = new uint256[](n);
        uint256 k = 0; // count of auto-cashout entries
        for (uint256 i = 0; i < n; ++i) {
            PlayerEntry storage e = entries[i];
            if (e.autoCashoutX100 == 0) {
                manualStakeSum += e.amount;
            } else {
                thresholds[k] = e.autoCashoutX100;
                stakes[k] = e.amount;
                k++;
            }
        }

        // Selection sort ascending by threshold — k <= MAX_PLAYERS_PER_ROUND
        // (100), trivially cheap.
        for (uint256 i = 0; i < k; ++i) {
            uint256 minIdx = i;
            for (uint256 j = i + 1; j < k; ++j) {
                if (thresholds[j] < thresholds[minIdx]) minIdx = j;
            }
            if (minIdx != i) {
                (thresholds[i], thresholds[minIdx]) = (thresholds[minIdx], thresholds[i]);
                (stakes[i], stakes[minIdx]) = (stakes[minIdx], stakes[i]);
            }
        }

        uint256 fixedSum = 0;
        uint256 segStart = 101;
        uint256 best = 101; // floor — matches _crashFromSeed's own minimum non-instabust result

        // k+1 segments: before thresholds[0], between consecutive
        // thresholds, and after thresholds[k-1] (up to the game's ceiling).
        for (uint256 i = 0; i <= k; ++i) {
            uint256 segEndInclusive = (i < k) ? thresholds[i] - 1 : MAX_AUTOCASHOUT_X100;

            if (segEndInclusive >= segStart) {
                if (fixedSum > available) {
                    // fixedSum only grows from here on (more thresholds
                    // just add more) — nothing later can possibly help.
                    break;
                }
                if (manualStakeSum == 0) {
                    // Flat segment: liability is constant (== fixedSum,
                    // already confirmed <= available) throughout.
                    if (segEndInclusive > best) best = segEndInclusive;
                } else {
                    // Liability grows linearly with X in this segment —
                    // solve for the largest X where
                    // fixedSum + manualStakeSum * X / 100 <= available.
                    uint256 x = ((available - fixedSum) * 100) / manualStakeSum;
                    if (x > segEndInclusive) x = segEndInclusive;
                    if (x >= segStart && x > best) best = x;
                }
            }

            if (i < k) {
                fixedSum += (stakes[i] * thresholds[i]) / 100;
                segStart = thresholds[i];
            }
        }

        return best;
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

    /// @notice Lowest crash value a no-risk (zero-player) round can draw —
    ///         10.00x. Below this, the round's public history would mostly
    ///         show the low crashes the normal curve produces most of the
    ///         time, defeating the point of the wider range below.
    uint256 public constant NO_RISK_FLOOR_X100 = 1000;

    /// @notice Crash point derived deterministically from the (revealed) seed.
    /// @dev Returns multiplier x100. Floor of 100 (= 1.00x). House edge is
    ///      `(BPS_DENOM - rtpBps) / BPS_DENOM` (was a hardcoded 1% before
    ///      `rtpBps` existed — this generalizes the exact same formula
    ///      shape rather than changing it: at rtpBps=9900 this reproduces
    ///      the old constants' distribution exactly). Distribution:
    ///      `rtpBps/100 / (1 - U)` where U is uniform in [0,1). A fraction
    ///      of rounds equal to the house edge insta-bust at 1.00x.
    ///      `view` not `pure` now that it reads `rtpBps`.
    ///
    ///      `noRisk` (true only when nobody joined this round — no stake,
    ///      no payout, nothing to protect any bettor's fairness against)
    ///      draws from a different, deliberately right-shifted range
    ///      instead: uniform over [NO_RISK_FLOOR_X100, MAX_AUTOCASHOUT_X100]
    ///      (10x-1000x), so the public round history stays visually rich
    ///      through a lull with no players, rather than mostly showing the
    ///      low crashes the normal curve produces most of the time. Still
    ///      fully determined by the same committed seed — not manipulable,
    ///      just a different mapping applied only when there is no one to
    ///      be unfair to.
    function _crashFromSeed(bytes32 seed, uint256 roundId, bool noRisk) internal view returns (uint256) {
        bytes32 mix = keccak256(abi.encodePacked(seed, roundId));
        uint256 r = uint256(mix);
        if (noRisk) {
            uint256 span = MAX_AUTOCASHOUT_X100 - NO_RISK_FLOOR_X100 + 1;
            return NO_RISK_FLOOR_X100 + (r % span);
        }
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
