// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CrashGame
/// @notice Multi-player crash game settled by an operator.
contract CrashGame is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum RoundStatus {
        Pending,
        Running,
        Resolved
    }

    struct Round {
        uint256 id;
        uint64 startedAt;
        uint64 resolvedAt;
        uint256 crashMultiplierX100;
        RoundStatus status;
    }

    struct PlayerEntry {
        address player;
        uint256 amount;
        uint256 autoCashoutX100;
        uint256 cashedOutAtX100;
        bool resolved;
    }

    IERC20 public immutable usdc;

    /// @notice Total number of rounds created.
    uint256 public currentRoundId;

    mapping(uint256 => Round) public rounds;
    mapping(uint256 => PlayerEntry[]) public roundPlayers;

    /// @notice Lookup index for a player's entry in a given round (1-based; 0 = none).
    mapping(uint256 => mapping(address => uint256)) private _playerEntryIndex;

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
    error ZeroAmount();

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event RoundStarted(uint256 indexed roundId);
    event RoundLocked(uint256 indexed roundId, uint64 startedAt);
    event PlayerJoined(
        uint256 indexed roundId,
        address indexed player,
        uint256 amount,
        uint256 autoCashoutX100
    );
    event PlayerCashedOut(uint256 indexed roundId, address indexed player, uint256 multiplierX100);
    event RoundResolved(uint256 indexed roundId, uint256 crashMultiplierX100);
    event PayoutSent(uint256 indexed roundId, address indexed player, uint256 amount);

    /// @param _usdc USDC token (6 decimals).
    /// @param admin Account granted DEFAULT_ADMIN + OPERATOR.
    constructor(address _usdc, address admin) {
        usdc = IERC20(_usdc);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    /// @notice Start a new pending round. Only one Pending round allowed at a time.
    function startRound() external onlyRole(OPERATOR_ROLE) returns (uint256 roundId) {
        if (currentRoundId != 0) {
            Round storage last = rounds[currentRoundId];
            if (last.status == RoundStatus.Pending || last.status == RoundStatus.Running) {
                revert PendingRoundExists();
            }
        }
        roundId = ++currentRoundId;
        rounds[roundId] = Round({
            id: roundId,
            startedAt: 0,
            resolvedAt: 0,
            crashMultiplierX100: 0,
            status: RoundStatus.Pending
        });
        emit RoundStarted(roundId);
    }

    /// @notice Join a pending round with `amount` USDC and optional auto-cashout.
    /// @param autoCashoutX100 Auto-cashout multiplier scaled by 100 (e.g. 200 = 2.00x). 0 disables.
    function joinRound(uint256 roundId, uint256 amount, uint256 autoCashoutX100)
        external
        nonReentrant
    {
        if (amount == 0) revert ZeroAmount();
        Round storage r = _round(roundId);
        if (r.status != RoundStatus.Pending) revert RoundNotPending();
        if (autoCashoutX100 != 0 && autoCashoutX100 <= 100) revert InvalidMultiplier();
        if (_playerEntryIndex[roundId][msg.sender] != 0) revert AlreadyJoined();

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

    /// @notice Lock a round, transitioning it to Running and disabling new joins.
    function lockRound(uint256 roundId) external onlyRole(OPERATOR_ROLE) {
        Round storage r = _round(roundId);
        if (r.status != RoundStatus.Pending) revert RoundNotPending();
        r.status = RoundStatus.Running;
        r.startedAt = uint64(block.timestamp);
        emit RoundLocked(roundId, r.startedAt);
    }

    /// @notice Manually cash out the caller at `multiplierX100`.
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

    /// @notice Resolve the round, compute payouts, and transfer winnings.
    function resolveRound(uint256 roundId, uint256 crashMultiplierX100)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
    {
        Round storage r = _round(roundId);
        if (r.status == RoundStatus.Resolved) revert RoundAlreadyResolved();
        if (r.status != RoundStatus.Running) revert RoundNotRunning();
        if (crashMultiplierX100 < 100) revert InvalidMultiplier();

        r.status = RoundStatus.Resolved;
        r.resolvedAt = uint64(block.timestamp);
        r.crashMultiplierX100 = crashMultiplierX100;

        PlayerEntry[] storage entries = roundPlayers[roundId];
        uint256 n = entries.length;
        for (uint256 i = 0; i < n; ++i) {
            PlayerEntry storage e = entries[i];
            if (e.resolved) continue;
            e.resolved = true;

            uint256 payout;
            // Manual cashout wins if it landed at or below the crash.
            if (e.cashedOutAtX100 != 0 && e.cashedOutAtX100 <= crashMultiplierX100) {
                payout = (e.amount * e.cashedOutAtX100) / 100;
            } else if (
                e.autoCashoutX100 != 0 && e.autoCashoutX100 <= crashMultiplierX100
            ) {
                // Auto-cashout triggers if set and not above the crash.
                payout = (e.amount * e.autoCashoutX100) / 100;
                e.cashedOutAtX100 = e.autoCashoutX100;
            }
            // else: player loses their full stake.

            if (payout > 0) {
                usdc.safeTransfer(e.player, payout);
                emit PayoutSent(roundId, e.player, payout);
            }
        }

        emit RoundResolved(roundId, crashMultiplierX100);
    }

    /// @notice Players in a round (read-only helper for tests / UI).
    function getRoundPlayerCount(uint256 roundId) external view returns (uint256) {
        return roundPlayers[roundId].length;
    }

    function _round(uint256 roundId) internal view returns (Round storage r) {
        r = rounds[roundId];
        if (r.id == 0) revert RoundNotFound();
    }
}
