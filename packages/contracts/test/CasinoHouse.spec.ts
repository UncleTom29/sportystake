import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const ONE_USDC = 10n ** 6n;
const usdc = (n: bigint | number) => BigInt(n) * ONE_USDC;

// Solidity CasinoHouse.GameType enum order — Dice=0, Slots=1, Blackjack=2, Roulette=3, Baccarat=4.
const Game = { Dice: 0, Slots: 1, Blackjack: 2, Roulette: 3, Baccarat: 4 };

describe("CasinoHouse", () => {
  async function deploy() {
    const [admin, p1, p2] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc_ = await MockUSDC.deploy();
    await usdc_.waitForDeployment();
    const Casino = await ethers.getContractFactory("CasinoHouse");
    const casino = await upgrades.deployProxy(Casino, [admin.address], {
      kind: "uups",
      constructorArgs: [await usdc_.getAddress()],
    });
    await casino.waitForDeployment();

    for (const u of [p1, p2]) await usdc_.mint(u.address, usdc(10_000));
    await usdc_.mint(admin.address, usdc(1_000_000));
    await usdc_.connect(admin).approve(await casino.getAddress(), usdc(1_000_000));
    await casino.connect(admin).depositBankroll(usdc(1_000_000));

    return { usdc_, casino, admin, p1, p2 };
  }

  async function placeBet(env: Awaited<ReturnType<typeof deploy>>, player = env.p1, amount = usdc(10)) {
    await env.usdc_.connect(player).approve(await env.casino.getAddress(), amount);
    const clientSeed = ethers.keccak256(ethers.toUtf8Bytes("client-seed"));
    const tx = await env.casino.connect(player).placeCasinoBet(amount, Game.Dice, clientSeed);
    const receipt = await tx.wait();
    const event = receipt!.logs
      .map((l) => { try { return env.casino.interface.parseLog(l); } catch { return null; } })
      .find((l) => l?.name === "BetReceived");
    const requestId = event!.args.requestId as string;
    return { requestId, amount };
  }

  describe("placeCasinoBet", () => {
    it("locks the stake into the bankroll and records the bet", async () => {
      const env = await loadFixture(deploy);
      const before = await env.usdc_.balanceOf(env.p1.address);
      const { requestId, amount } = await placeBet(env);
      const after = await env.usdc_.balanceOf(env.p1.address);
      expect(before - after).to.equal(amount);

      const bet = await env.casino.bets(requestId);
      expect(bet.player).to.equal(env.p1.address);
      expect(bet.amount).to.equal(amount);
      expect(bet.settled).to.equal(false);
    });

    it("reverts on a zero-amount bet", async () => {
      const env = await loadFixture(deploy);
      const clientSeed = ethers.keccak256(ethers.toUtf8Bytes("seed"));
      await expect(
        env.casino.connect(env.p1).placeCasinoBet(0, Game.Dice, clientSeed)
      ).to.be.revertedWithCustomError(env.casino, "ZeroAmount");
    });

    it("derives a distinct requestId for each successive bet from the same player", async () => {
      const env = await loadFixture(deploy);
      const { requestId: first } = await placeBet(env);
      const { requestId: second } = await placeBet(env);
      expect(first).to.not.equal(second);
    });
  });

  describe("settleGame", () => {
    it("pays the player out of the bankroll on a win", async () => {
      const env = await loadFixture(deploy);
      const { requestId, amount } = await placeBet(env);
      const payout = amount * 2n;
      const before = await env.usdc_.balanceOf(env.p1.address);

      await expect(env.casino.connect(env.admin).settleGame(requestId, 42, payout))
        .to.emit(env.casino, "GameSettled")
        .withArgs(requestId, env.p1.address, 42n, payout);

      const after = await env.usdc_.balanceOf(env.p1.address);
      expect(after - before).to.equal(payout);
      expect((await env.casino.bets(requestId)).settled).to.equal(true);
    });

    it("settles a loss with zero payout and no transfer", async () => {
      const env = await loadFixture(deploy);
      const { requestId } = await placeBet(env);
      const before = await env.usdc_.balanceOf(env.p1.address);

      await env.casino.connect(env.admin).settleGame(requestId, 7, 0);

      const after = await env.usdc_.balanceOf(env.p1.address);
      expect(after).to.equal(before);
      expect((await env.casino.bets(requestId)).payout).to.equal(0n);
    });

    it("reverts when called by anyone without OPERATOR_ROLE", async () => {
      const env = await loadFixture(deploy);
      const { requestId } = await placeBet(env);
      await expect(
        env.casino.connect(env.p2).settleGame(requestId, 1, 0)
      ).to.be.reverted;
    });

    it("reverts settling an unknown requestId", async () => {
      const env = await loadFixture(deploy);
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      await expect(
        env.casino.connect(env.admin).settleGame(fakeId, 1, 0)
      ).to.be.revertedWithCustomError(env.casino, "BetNotFound");
    });

    it("reverts settling the same bet twice", async () => {
      const env = await loadFixture(deploy);
      const { requestId } = await placeBet(env);
      await env.casino.connect(env.admin).settleGame(requestId, 1, 0);
      await expect(
        env.casino.connect(env.admin).settleGame(requestId, 1, 0)
      ).to.be.revertedWithCustomError(env.casino, "BetAlreadySettled");
    });

    it("scales payout down to available bankroll balance if requested payout exceeds balance", async () => {
      const env = await loadFixture(deploy);
      const { requestId } = await placeBet(env);
      const bankroll = await env.usdc_.balanceOf(await env.casino.getAddress());
      const requested = bankroll + usdc(500);

      const before = await env.usdc_.balanceOf(env.p1.address);
      await env.casino.connect(env.admin).settleGame(requestId, 1, requested);
      const after = await env.usdc_.balanceOf(env.p1.address);

      expect(after - before).to.equal(bankroll);
      expect((await env.casino.bets(requestId)).payout).to.equal(bankroll);
    });
  });

  describe("bankroll management", () => {
    it("only ADMIN_ROLE can deposit or withdraw bankroll", async () => {
      const env = await loadFixture(deploy);
      await env.usdc_.connect(env.p1).approve(await env.casino.getAddress(), usdc(10));
      await expect(
        env.casino.connect(env.p1).depositBankroll(usdc(10))
      ).to.be.reverted;
      await expect(
        env.casino.connect(env.p1).withdrawBankroll(usdc(10), env.p1.address)
      ).to.be.reverted;
    });

    it("withdrawBankroll moves funds out and reverts past the available balance", async () => {
      const env = await loadFixture(deploy);
      const bankroll = await env.usdc_.balanceOf(await env.casino.getAddress());
      const before = await env.usdc_.balanceOf(env.admin.address);

      await env.casino.connect(env.admin).withdrawBankroll(usdc(1000), env.admin.address);

      const after = await env.usdc_.balanceOf(env.admin.address);
      expect(after - before).to.equal(usdc(1000));

      await expect(
        env.casino.connect(env.admin).withdrawBankroll(bankroll + usdc(1), env.admin.address)
      ).to.be.revertedWithCustomError(env.casino, "InsufficientBankroll");
    });
  });

  describe("UUPS upgrade", () => {
    it("only DEFAULT_ADMIN_ROLE can authorize an upgrade", async () => {
      const env = await loadFixture(deploy);
      await expect(
        env.casino.connect(env.p1).upgradeToAndCall(await env.casino.getAddress(), "0x")
      ).to.be.reverted;
    });
  });
});
