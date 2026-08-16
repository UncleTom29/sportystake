// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {ReentrancyGuardUpgradeable} from "./vendor/ReentrancyGuardUpgradeable.sol";

/// @title CasinoHouse
/// @notice Operator-settled, single-bankroll casino vault for USDC games.
contract CasinoHouse is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum GameType {
        Dice,
        Slots,
        Blackjack,
        Roulette,
        Baccarat
    }

    struct CasinoBet {
        address player;
        uint256 amount;
        GameType game;
        bytes32 clientSeed;
        bool settled;
        uint256 payout;
        uint256 reservedExposure;
    }

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IERC20 public immutable usdc;

    /// @notice Player-supplied entropy mapped to the on-chain bet record.
    mapping(bytes32 => CasinoBet) public bets;

    /// @notice Monotonic nonce per player to derive request IDs.
    mapping(address => uint256) public nonces;

    mapping(GameType => uint256) public maxMultiplierX100;
    uint256 public totalPendingExposure;

    uint256 public constant PAYOUT_CAP_BPS = 4000; // 40.00% cap of total deposits per round
    uint256 public currentRoundId;

    struct RoundState {
        uint256 roundId;
        uint256 startedAt;
        uint256 totalDeposits;
        uint256 totalPayouts;
        bool resolved;
    }

    mapping(uint256 => RoundState) public rounds;
    mapping(uint256 => mapping(address => uint256)) public roundUserDeposits;
    mapping(uint256 => address[]) public roundParticipants;

    uint256[40] private __gap;

    // -----------------------------------------------------------------------
    // Errors
    // -----------------------------------------------------------------------

    error ZeroAmount();
    error BetNotFound();
    error BetAlreadySettled();
    error InsufficientBankroll();
    error MaxMultiplierNotSet();
    error RoundAlreadyResolved();
    error PayoutExceedsCap();

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event MaxMultiplierUpdated(GameType indexed game, uint256 multiplierX100);

    event BetReceived(
        bytes32 indexed requestId,
        address indexed player,
        GameType indexed game,
        uint256 amount,
        bytes32 clientSeed
    );
    event GameSettled(
        bytes32 indexed requestId,
        address indexed player,
        uint256 randomResult,
        uint256 payout
    );
    event BankrollDeposit(address indexed from, uint256 amount);
    event BankrollWithdraw(address indexed to, uint256 amount);

    event RoundOpened(uint256 indexed roundId, uint256 startedAt);
    event RoundJoined(uint256 indexed roundId, address indexed player, GameType indexed game, uint256 amount);
    event RoundResolved(uint256 indexed roundId, uint256 totalDeposits, uint256 totalPayouts, uint256 winnersCount);

    /// @param _usdc USDC token (6 decimals). Immutable — identical across upgrades.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        _disableInitializers();
    }

    /// @param admin Account granted ADMIN, OPERATOR, DEFAULT_ADMIN roles.
    function initialize(address admin) external initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);

        maxMultiplierX100[GameType.Dice] = 9900;
        maxMultiplierX100[GameType.Slots] = 5000;
        maxMultiplierX100[GameType.Blackjack] = 300;
        maxMultiplierX100[GameType.Roulette] = 3600;
        maxMultiplierX100[GameType.Baccarat] = 900;

        currentRoundId = 1;
        rounds[1] = RoundState({
            roundId: 1,
            startedAt: block.timestamp,
            totalDeposits: 0,
            totalPayouts: 0,
            resolved: false
        });
        emit RoundOpened(1, block.timestamp);
    }

    function setMaxMultiplier(GameType game, uint256 multiplierX100) external onlyRole(ADMIN_ROLE) {
        maxMultiplierX100[game] = multiplierX100;
        emit MaxMultiplierUpdated(game, multiplierX100);
    }

    /// @notice Join an active pool-capped casino round.
    function joinPoolRound(uint256 roundId, GameType game, uint256 amount, bytes32 clientSeed)
        external
        nonReentrant
    {
        if (amount == 0) revert ZeroAmount();

        RoundState storage r = rounds[roundId];
        if (r.roundId == 0) {
            r.roundId = roundId;
            r.startedAt = block.timestamp;
        }
        if (r.resolved) revert BetAlreadySettled();

        if (roundUserDeposits[roundId][msg.sender] == 0) {
            roundParticipants[roundId].push(msg.sender);
        }
        roundUserDeposits[roundId][msg.sender] += amount;
        r.totalDeposits += amount;

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit RoundJoined(roundId, msg.sender, game, amount);
    }

    /// @notice Resolve a pool-capped casino round. Total payouts are capped at 40% of round deposits.
    function resolvePoolRound(
        uint256 roundId,
        address[] calldata winners,
        uint256[] calldata payouts
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        RoundState storage r = rounds[roundId];
        if (r.resolved) revert RoundAlreadyResolved();

        uint256 maxPayoutCap = (r.totalDeposits * PAYOUT_CAP_BPS) / 10000;
        uint256 sumPayouts = 0;
        for (uint256 i = 0; i < payouts.length; i++) {
            sumPayouts += payouts[i];
        }

        if (sumPayouts > maxPayoutCap) revert PayoutExceedsCap();

        r.resolved = true;
        r.totalPayouts = sumPayouts;

        for (uint256 i = 0; i < winners.length; i++) {
            if (payouts[i] > 0) {
                usdc.safeTransfer(winners[i], payouts[i]);
            }
        }

        emit RoundResolved(roundId, r.totalDeposits, sumPayouts, winners.length);

        // Transition to next continuous round
        uint256 nextRoundId = roundId + 1;
        currentRoundId = nextRoundId;
        if (rounds[nextRoundId].roundId == 0) {
            rounds[nextRoundId] = RoundState({
                roundId: nextRoundId,
                startedAt: block.timestamp,
                totalDeposits: 0,
                totalPayouts: 0,
                resolved: false
            });
            emit RoundOpened(nextRoundId, block.timestamp);
        }
    }

    /// @notice Place a casino bet. Operator settles it asynchronously.
    function placeCasinoBet(uint256 amount, GameType game, bytes32 clientSeed)
        external
        nonReentrant
        returns (bytes32 requestId)
    {
        if (amount == 0) revert ZeroAmount();

        if (maxMultiplierX100[game] == 0) revert MaxMultiplierNotSet();
        uint256 maxPayout = (amount * maxMultiplierX100[game]) / 100;
        totalPendingExposure += maxPayout;

        uint256 nonce = nonces[msg.sender]++;
        requestId = keccak256(
            abi.encodePacked(msg.sender, nonce, clientSeed, block.chainid)
        );

        bets[requestId] = CasinoBet({
            player: msg.sender,
            amount: amount,
            game: game,
            clientSeed: clientSeed,
            settled: false,
            payout: 0,
            reservedExposure: maxPayout
        });

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit BetReceived(requestId, msg.sender, game, amount, clientSeed);
    }

    /// @notice Settle a placed bet with `payout` USDC (0 = full loss).
    /// @dev Applies solvency-aware payout scaling if bankroll balance < quoted payout.
    function settleGame(bytes32 requestId, uint256 randomResult, uint256 payout)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
    {
        CasinoBet storage b = bets[requestId];
        if (b.player == address(0)) revert BetNotFound();
        if (b.settled) revert BetAlreadySettled();

        b.settled = true;
        totalPendingExposure -= b.reservedExposure;

        uint256 actualPayout = payout;
        uint256 bal = usdc.balanceOf(address(this));
        if (actualPayout > bal) {
            actualPayout = bal;
        }

        b.payout = actualPayout;

        if (actualPayout > 0) {
            usdc.safeTransfer(b.player, actualPayout);
        }

        emit GameSettled(requestId, b.player, randomResult, actualPayout);
    }

    /// @notice Top up the bankroll from `msg.sender`.
    function depositBankroll(uint256 amount) external onlyRole(ADMIN_ROLE) {
        if (amount == 0) revert ZeroAmount();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit BankrollDeposit(msg.sender, amount);
    }

    /// @notice Pull `amount` USDC out of the bankroll to `to`.
    function withdrawBankroll(uint256 amount, address to) external onlyRole(ADMIN_ROLE) {
        if (amount == 0) revert ZeroAmount();
        if (usdc.balanceOf(address(this)) < amount) revert InsufficientBankroll();
        usdc.safeTransfer(to, amount);
        emit BankrollWithdraw(to, amount);
    }

    // -----------------------------------------------------------------------
    // UUPS
    // -----------------------------------------------------------------------

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
