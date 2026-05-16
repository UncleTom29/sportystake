// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CasinoHouse
/// @notice Operator-settled, single-bankroll casino vault for USDC games.
contract CasinoHouse is AccessControl, ReentrancyGuard {
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
    }

    IERC20 public immutable usdc;

    /// @notice Player-supplied entropy mapped to the on-chain bet record.
    mapping(bytes32 => CasinoBet) public bets;

    /// @notice Monotonic nonce per player to derive request IDs.
    mapping(address => uint256) public nonces;

    // -----------------------------------------------------------------------
    // Errors
    // -----------------------------------------------------------------------

    error ZeroAmount();
    error BetNotFound();
    error BetAlreadySettled();
    error InsufficientBankroll();

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

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

    /// @param _usdc USDC token (6 decimals).
    /// @param admin Account granted ADMIN, OPERATOR, DEFAULT_ADMIN roles.
    constructor(address _usdc, address admin) {
        usdc = IERC20(_usdc);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    /// @notice Place a casino bet. Operator settles it asynchronously.
    function placeCasinoBet(uint256 amount, GameType game, bytes32 clientSeed)
        external
        nonReentrant
        returns (bytes32 requestId)
    {
        if (amount == 0) revert ZeroAmount();

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
            payout: 0
        });

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit BetReceived(requestId, msg.sender, game, amount, clientSeed);
    }

    /// @notice Settle a placed bet with `payout` USDC (0 = full loss).
    function settleGame(bytes32 requestId, uint256 randomResult, uint256 payout)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
    {
        CasinoBet storage b = bets[requestId];
        if (b.player == address(0)) revert BetNotFound();
        if (b.settled) revert BetAlreadySettled();

        b.settled = true;
        b.payout = payout;

        if (payout > 0) {
            if (usdc.balanceOf(address(this)) < payout) revert InsufficientBankroll();
            usdc.safeTransfer(b.player, payout);
        }

        emit GameSettled(requestId, b.player, randomResult, payout);
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
}
