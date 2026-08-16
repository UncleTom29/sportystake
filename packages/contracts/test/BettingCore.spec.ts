import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import type { Signer } from "ethers";

const USDC_DECIMALS = 6n;
const ONE_USDC = 10n ** USDC_DECIMALS;
const ODDS_DENOM = 1000n;
const BPS = 10_000n;

function usdc(n: bigint | number): bigint {
  return BigInt(n) * ONE_USDC;
}

function marketId(label: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

describe("BettingCore", () => {
  async function deploy() {
    const [admin, treasury, lp1, lp2, bettor1, bettor2] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc_ = await MockUSDC.deploy();
    await usdc_.waitForDeployment();
    const usdcAddress = await usdc_.getAddress();

    const Pool = await ethers.getContractFactory("LiquidityPool");
    const pool = await upgrades.deployProxy(Pool, [admin.address], {
      kind: "uups",
      constructorArgs: [usdcAddress],
    });
    await pool.waitForDeployment();
    const poolAddress = await pool.getAddress();

    const Core = await ethers.getContractFactory("BettingCore");
    const core = await upgrades.deployProxy(
      Core,
      [poolAddress, treasury.address, admin.address],
      {
        kind: "uups",
        constructorArgs: [usdcAddress],
        // initializeV2 (reinitializer(2)) calls __EIP712_init separately from
        // initialize()'s AccessControl/Pausable/ReentrancyGuard inits — the
        // validator can't see across the two-phase split, but both halves
        // together do call every parent init exactly once. See
        // BettingCore.sol's initializeV2 doc comment.
        unsafeAllow: ["missing-initializer-call", "incorrect-initializer-order"],
      }
    );
    await core.waitForDeployment();
    const coreAddress = await core.getAddress();

    await pool.connect(admin).setBettingCore(coreAddress);

    // Mint USDC for all actors.
    for (const a of [lp1, lp2, bettor1, bettor2]) {
      await usdc_.mint(a.address, usdc(100_000));
    }

    return { usdc_, pool, core, admin, treasury, lp1, lp2, bettor1, bettor2 };
  }

  async function createOpenMarket(label = "fx-1") {
    const env = await deploy();
    const id = marketId(label);
    const closesAt = (await time.latest()) + 3600;
    await env.core.createMarket(id, closesAt);
    return { ...env, marketIdHex: id, closesAt };
  }

  async function seedPool(
    env: Awaited<ReturnType<typeof createOpenMarket>>,
    lp: Signer,
    amount: bigint,
  ) {
    const lpAddress = await lp.getAddress();
    await env.usdc_.connect(lp).approve(await env.pool.getAddress(), amount);
    await env.pool.connect(lp).deposit(amount);
    return lpAddress;
  }

  describe("createMarket", () => {
    it("registers a market against the shared pool (no per-market pool deployed)", async () => {
      const env = await loadFixture(createOpenMarket);
      const m = await env.core.markets(env.marketIdHex);
      expect(m.status).to.equal(0); // Open
      expect(await env.core.liquidityPool()).to.equal(await env.pool.getAddress());
    });

    it("reverts on duplicate marketId", async () => {
      const env = await loadFixture(createOpenMarket);
      await expect(env.core.createMarket(env.marketIdHex, env.closesAt + 100))
        .to.be.revertedWithCustomError(env.core, "MarketAlreadyExists");
    });

    it("reverts when closesAt is in the past", async () => {
      const env = await loadFixture(deploy);
      const past = (await time.latest()) - 60;
      await expect(env.core.createMarket(marketId("x"), past))
        .to.be.revertedWithCustomError(env.core, "InvalidClosesAt");
    });
  });

  describe("placeBet", () => {
    it("places a bet, locks shared-pool collateral, transfers stake", async () => {
      const env = await loadFixture(createOpenMarket);
      await seedPool(env, env.lp1, usdc(10_000));

      const amount = usdc(100);
      const oddsX1000 = 2_500n; // 2.5x
      await env.usdc_.connect(env.bettor1).approve(await env.core.getAddress(), amount);

      const tx = await env.core
        .connect(env.bettor1)
        .placeBet(env.marketIdHex, 0, amount, oddsX1000, oddsX1000);
      const r = await tx.wait();

      const log = r!.logs.find((l) => {
        try { return env.core.interface.parseLog(l)?.name === "BetPlaced"; }
        catch { return false; }
      });
      expect(log).to.exist;

      const m = await env.core.markets(env.marketIdHex);
      expect(m.totalBetAmount).to.equal(amount);

      const expectedLock = (amount * oddsX1000) / ODDS_DENOM - amount;
      expect(await env.pool.marketLocked(env.marketIdHex)).to.equal(expectedLock);
      expect(await env.pool.lockedForPayouts()).to.equal(expectedLock);
    });

    it("reverts when amount below minBet", async () => {
      const env = await loadFixture(createOpenMarket);
      await seedPool(env, env.lp1, usdc(10_000));
      const amount = usdc(1); // below 5 USDC min
      await env.usdc_.connect(env.bettor1).approve(await env.core.getAddress(), amount);
      await expect(env.core.connect(env.bettor1).placeBet(env.marketIdHex, 0, amount, 2000n, 2000n))
        .to.be.revertedWithCustomError(env.core, "BetAmountOutOfRange");
    });

    it("reverts when odds slip below minOdds", async () => {
      const env = await loadFixture(createOpenMarket);
      await seedPool(env, env.lp1, usdc(10_000));
      const amount = usdc(100);
      await env.usdc_.connect(env.bettor1).approve(await env.core.getAddress(), amount);
      await expect(env.core.connect(env.bettor1).placeBet(env.marketIdHex, 0, amount, 2000n, 2500n))
        .to.be.revertedWithCustomError(env.core, "OddsBelowSlippage");
    });

    it("reverts past closesAt", async () => {
      const env = await loadFixture(createOpenMarket);
      await seedPool(env, env.lp1, usdc(10_000));
      await time.increaseTo(env.closesAt + 1);
      const amount = usdc(100);
      await env.usdc_.connect(env.bettor1).approve(await env.core.getAddress(), amount);
      await expect(env.core.connect(env.bettor1).placeBet(env.marketIdHex, 0, amount, 2000n, 2000n))
        .to.be.revertedWithCustomError(env.core, "MarketClosed");
    });

    it("accepts bet exceeding 80% pool utilization and scales payout on settlement", async () => {
      const env = await loadFixture(createOpenMarket);
      await seedPool(env, env.lp1, usdc(1000));
      const amount = usdc(100);
      await env.usdc_.connect(env.bettor1).approve(await env.core.getAddress(), amount);
      const tx = await env.core.connect(env.bettor1).placeBet(env.marketIdHex, 0, amount, 10_000n, 10_000n);
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l) => { try { return env.core.interface.parseLog(l); } catch { return null; } })
        .find((l) => l?.name === "BetPlaced");
      const betId = event!.args.betId as string;

      // Drain pool balance to ~400 USDC to force payout scaling
      const poolAddr = await env.pool.getAddress();
      await ethers.provider.send("hardhat_setBalance", [poolAddr, "0x1000000000000000000"]);
      const poolSigner = await ethers.getImpersonatedSigner(poolAddr);
      await env.usdc_.connect(poolSigner).transfer(env.admin.address, usdc(600));

      // Settle market: quoted ΣQ = 1000, stake ΣS = 100, totalBetAmount = 100.
      // deficit = 1000 - 100 = 900, available = ~400, covered = 400, L = 500
      // fillRatioX1000 = (500 - 100) * 1000 / (1000 - 100) = 400_000 / 900 = 444
      await env.core.connect(env.admin).settleMarket(env.marketIdHex, 0, [betId], usdc(1000));

      // potentialPayout stays as the original quoted ceiling (not mutated)
      const bet = await env.core.bets(betId);
      expect(bet.status).to.equal(1); // Won
      expect(bet.potentialPayout).to.equal(usdc(1000));

      // fillRatioX1000 stored on the Market struct
      const market = await env.core.markets(env.marketIdHex);
      expect(market.fillRatioX1000).to.equal(444n);

      // claimWinnings pays: stake + fillRatio * (quoted - stake) / 1000
      // = 100e6 + 444 * 900e6 / 1000 = 100_000_000 + 399_600_000 = 499_600_000
      const balBefore = await env.usdc_.balanceOf(env.bettor1.address);
      await env.core.connect(env.bettor1).claimWinnings(betId);
      const balAfter = await env.usdc_.balanceOf(env.bettor1.address);
      expect(balAfter - balBefore).to.equal(499_600_000n);
    });
  });

  describe("two markets sharing one pool", () => {
    it("settles independently without cross-contaminating locked liquidity", async () => {
      const env = await loadFixture(createOpenMarket);
      await seedPool(env, env.lp1, usdc(10_000));

      const closesAt = (await time.latest()) + 3600;
      const marketB = marketId("fx-2");
      await env.core.createMarket(marketB, closesAt);

      const stake = usdc(100);
      const odds = 2_000n; // 2x

      await env.usdc_.connect(env.bettor1).approve(await env.core.getAddress(), stake);
      const txA = await env.core.connect(env.bettor1).placeBet(env.marketIdHex, 0, stake, odds, odds);
      const rA = await txA.wait();
      const betIdA = env.core.interface.parseLog(
        rA!.logs.find((l) => {
          try { return env.core.interface.parseLog(l)?.name === "BetPlaced"; } catch { return false; }
        })!
      )!.args[0] as string;

      await env.usdc_.connect(env.bettor2).approve(await env.core.getAddress(), stake);
      await env.core.connect(env.bettor2).placeBet(marketB, 0, stake, odds, odds);

      // Both markets have locked collateral in the same shared pool.
      expect(await env.pool.lockedForPayouts()).to.equal(usdc(200));

      // Settle only market A (bettor1 wins). Market B's lock must be untouched.
      const payoutA = (stake * odds) / ODDS_DENOM;
      await env.core.settleMarket(env.marketIdHex, 0, [betIdA], payoutA);

      expect(await env.pool.marketLocked(env.marketIdHex)).to.equal(0n);
      expect(await env.pool.marketLocked(marketB)).to.equal(usdc(100));
      expect(await env.pool.lockedForPayouts()).to.equal(usdc(100));

      // Bettor1 can still claim; market B remains open and bettable.
      await env.core.connect(env.bettor1).claimWinnings(betIdA);
    });
  });

  describe("settleMarket + claimWinnings", () => {
    it("happy path: bettor wins, claims, treasury gets edge", async () => {
      const env = await loadFixture(createOpenMarket);
      await seedPool(env, env.lp1, usdc(10_000));

      const stake = usdc(100);
      const odds = 2_000n; // 2x
      await env.usdc_.connect(env.bettor1).approve(await env.core.getAddress(), stake);
      const tx = await env.core.connect(env.bettor1).placeBet(env.marketIdHex, 0, stake, odds, odds);
      const r = await tx.wait();
      const log = r!.logs.find((l) => {
        try { return env.core.interface.parseLog(l)?.name === "BetPlaced"; }
        catch { return false; }
      });
      const betId = env.core.interface.parseLog(log!)!.args[0] as string;

      const payout = (stake * odds) / ODDS_DENOM;

      // Place a larger 2nd bet on the losing outcome so the pool ends up
      // with a genuine surplus (totalBetAmount > totalPayoutRequired) —
      // a tie pays out the full stake pool with no vig, by design.
      const stakeB = usdc(150);
      await env.usdc_.connect(env.bettor2).approve(await env.core.getAddress(), stakeB);
      await env.core.connect(env.bettor2).placeBet(env.marketIdHex, 1, stakeB, odds, odds);

      // Outcome 0 wins. Total payout = payout (only bettor1).
      const totalBetAmount = stake + stakeB;
      const treasuryBefore = await env.usdc_.balanceOf(env.treasury.address);
      await env.core.settleMarket(env.marketIdHex, 0, [betId], payout);
      const treasuryAfter = await env.usdc_.balanceOf(env.treasury.address);

      // House edge of 2% of totalBetAmount (250 USDC) = 5 USDC.
      const edge = (totalBetAmount * 200n) / BPS;
      expect(treasuryAfter - treasuryBefore).to.equal(edge);

      const before = await env.usdc_.balanceOf(env.bettor1.address);
      await env.core.connect(env.bettor1).claimWinnings(betId);
      const after = await env.usdc_.balanceOf(env.bettor1.address);
      expect(after - before).to.equal(payout);
    });

    it("fillRatioX1000 is 1000 when market self-funds (losers cover winners)", async () => {
      const env = await loadFixture(createOpenMarket);
      await seedPool(env, env.lp1, usdc(10_000));
      const stake = usdc(100);
      const odds = 2_000n; // 2x

      // Bettor1 bets outcome 0, bettor2 bets outcome 1 — whoever loses funds the winner.
      await env.usdc_.connect(env.bettor1).approve(await env.core.getAddress(), stake);
      const tx = await env.core.connect(env.bettor1).placeBet(env.marketIdHex, 0, stake, odds, odds);
      const r = await tx.wait();
      const betId = env.core.interface.parseLog(
        r!.logs.find((l) => {
          try { return env.core.interface.parseLog(l)?.name === "BetPlaced"; } catch { return false; }
        })!
      )!.args[0] as string;

      await env.usdc_.connect(env.bettor2).approve(await env.core.getAddress(), usdc(150));
      await env.core.connect(env.bettor2).placeBet(env.marketIdHex, 1, usdc(150), odds, odds);

      // totalBetAmount = 250, winning payout = 200. deficit = 0 → fillRatio = 1000.
      await env.core.settleMarket(env.marketIdHex, 0, [betId], usdc(200));
      const market = await env.core.markets(env.marketIdHex);
      expect(market.fillRatioX1000).to.equal(1000n);

      // claimWinnings pays full quoted payout
      const before = await env.usdc_.balanceOf(env.bettor1.address);
      await env.core.connect(env.bettor1).claimWinnings(betId);
      const after = await env.usdc_.balanceOf(env.bettor1.address);
      expect(after - before).to.equal(usdc(200));
    });

    it("reverts settle with PayoutSumMismatch on wrong total", async () => {
      const env = await loadFixture(createOpenMarket);
      await seedPool(env, env.lp1, usdc(10_000));
      const stake = usdc(100);
      const odds = 2_000n;
      await env.usdc_.connect(env.bettor1).approve(await env.core.getAddress(), stake);
      const tx = await env.core.connect(env.bettor1).placeBet(env.marketIdHex, 0, stake, odds, odds);
      const r = await tx.wait();
      const log = r!.logs.find((l) => {
        try { return env.core.interface.parseLog(l)?.name === "BetPlaced"; }
        catch { return false; }
      });
      const betId = env.core.interface.parseLog(log!)!.args[0] as string;
      await expect(env.core.settleMarket(env.marketIdHex, 0, [betId], usdc(999)))
        .to.be.revertedWithCustomError(env.core, "PayoutSumMismatch");
    });

    it("reverts settle past MAX_SETTLE_BATCH", async () => {
      const env = await loadFixture(createOpenMarket);
      // Build a fake-large array — the loop dies before reading the bets.
      const huge = Array.from({ length: 501 }, () => ethers.ZeroHash);
      await expect(env.core.settleMarket(env.marketIdHex, 0, huge, 0))
        .to.be.revertedWithCustomError(env.core, "TooManyBets");
    });
  });

  describe("cancelMarket + claimRefund", () => {
    it("refunds stake when market is cancelled", async () => {
      const env = await loadFixture(createOpenMarket);
      await seedPool(env, env.lp1, usdc(10_000));
      const stake = usdc(50);
      await env.usdc_.connect(env.bettor1).approve(await env.core.getAddress(), stake);
      const tx = await env.core.connect(env.bettor1).placeBet(env.marketIdHex, 0, stake, 2000n, 2000n);
      const r = await tx.wait();
      const log = r!.logs.find((l) => {
        try { return env.core.interface.parseLog(l)?.name === "BetPlaced"; }
        catch { return false; }
      });
      const betId = env.core.interface.parseLog(log!)!.args[0] as string;

      await env.core.cancelMarket(env.marketIdHex);
      expect(await env.pool.marketLocked(env.marketIdHex)).to.equal(0n);

      const before = await env.usdc_.balanceOf(env.bettor1.address);
      await env.core.connect(env.bettor1).claimRefund(betId);
      const after = await env.usdc_.balanceOf(env.bettor1.address);
      expect(after - before).to.equal(stake);
    });
  });

  describe("voidBet", () => {
    async function placeBetGetId(
      env: Awaited<ReturnType<typeof createOpenMarket>>,
      bettor: Signer,
      outcome: number,
      stake: bigint,
      odds: bigint,
    ): Promise<string> {
      await env.usdc_.connect(bettor).approve(await env.core.getAddress(), stake);
      const tx = await env.core.connect(bettor).placeBet(env.marketIdHex, outcome, stake, odds, odds);
      const r = await tx.wait();
      const log = r!.logs.find((l) => {
        try { return env.core.interface.parseLog(l)?.name === "BetPlaced"; }
        catch { return false; }
      });
      return env.core.interface.parseLog(log!)!.args[0] as string;
    }

    it("refunds the stake, releases only that bet's lock, and adjusts totalBetAmount", async () => {
      const env = await loadFixture(createOpenMarket);
      await seedPool(env, env.lp1, usdc(10_000));
      const stake = usdc(100);
      const odds = 2_000n; // 2x -> lockNeeded = 100
      const betId = await placeBetGetId(env, env.bettor1, 0, stake, odds);

      expect(await env.pool.marketLocked(env.marketIdHex)).to.equal(usdc(100));
      const before = await env.usdc_.balanceOf(env.bettor1.address);

      await expect(env.core.voidBet(betId))
        .to.emit(env.core, "BetVoided")
        .withArgs(betId, env.bettor1.address, stake);

      const after = await env.usdc_.balanceOf(env.bettor1.address);
      expect(after - before).to.equal(stake);
      expect(await env.pool.marketLocked(env.marketIdHex)).to.equal(0n);
      expect((await env.core.markets(env.marketIdHex)).totalBetAmount).to.equal(0n);
      expect((await env.core.bets(betId)).status).to.equal(3); // Cancelled
    });

    it("keeps settleMarket's accounting correct for the remaining bets after a void", async () => {
      const env = await loadFixture(createOpenMarket);
      await seedPool(env, env.lp1, usdc(10_000));
      const odds = 2_000n; // 2x

      // A push-like bet that gets voided, plus a normal winning bet.
      const voidedStake = usdc(100);
      const voidedId = await placeBetGetId(env, env.bettor2, 1, voidedStake, odds);
      const winningStake = usdc(50);
      const winningId = await placeBetGetId(env, env.bettor1, 0, winningStake, odds);

      await env.core.voidBet(voidedId);

      const payout = (winningStake * odds) / ODDS_DENOM;
      // totalBetAmount should now only reflect the still-pending bet — the
      // voided bet's stake was already refunded, not left in the pool.
      expect((await env.core.markets(env.marketIdHex)).totalBetAmount).to.equal(winningStake);

      // Settling must not revert, and must not re-touch the voided bet.
      await env.core.settleMarket(env.marketIdHex, 0, [winningId], payout);
      expect((await env.core.bets(voidedId)).status).to.equal(3); // still Cancelled, untouched
      expect((await env.core.bets(winningId)).status).to.equal(1); // Won

      const before = await env.usdc_.balanceOf(env.bettor1.address);
      await env.core.connect(env.bettor1).claimWinnings(winningId);
      const after = await env.usdc_.balanceOf(env.bettor1.address);
      expect(after - before).to.equal(payout);
    });

    it("reverts when called by anyone without OPERATOR_ROLE", async () => {
      const env = await loadFixture(createOpenMarket);
      await seedPool(env, env.lp1, usdc(10_000));
      const betId = await placeBetGetId(env, env.bettor1, 0, usdc(10), 2000n);
      await expect(env.core.connect(env.bettor1).voidBet(betId)).to.be.reverted;
    });

    it("reverts voiding an already-settled bet", async () => {
      const env = await loadFixture(createOpenMarket);
      await seedPool(env, env.lp1, usdc(10_000));
      const stake = usdc(100);
      const odds = 2_000n;
      const betId = await placeBetGetId(env, env.bettor1, 0, stake, odds);
      const payout = (stake * odds) / ODDS_DENOM;
      await env.core.settleMarket(env.marketIdHex, 0, [betId], payout);
      await expect(env.core.voidBet(betId)).to.be.revertedWithCustomError(env.core, "BetNotRefundable");
    });

    it("reverts voiding a bet on an already-cancelled market", async () => {
      const env = await loadFixture(createOpenMarket);
      await seedPool(env, env.lp1, usdc(10_000));
      const betId = await placeBetGetId(env, env.bettor1, 0, usdc(10), 2000n);
      await env.core.cancelMarket(env.marketIdHex);
      await expect(env.core.voidBet(betId)).to.be.revertedWithCustomError(env.core, "MarketAlreadyCancelled");
    });
  });

  describe("pause", () => {
    it("blocks placeBet when paused", async () => {
      const env = await loadFixture(createOpenMarket);
      await env.core.pause();
      await env.usdc_.connect(env.bettor1).approve(await env.core.getAddress(), usdc(10));
      await expect(env.core.connect(env.bettor1).placeBet(env.marketIdHex, 0, usdc(10), 2000n, 2000n))
        .to.be.revertedWithCustomError(env.core, "EnforcedPause");
    });
  });

  describe("parlays", () => {
    async function createTwoOpenMarkets() {
      const env = await deploy();
      const closesAt = (await time.latest()) + 3600;
      const marketA = marketId("parlay-a");
      const marketB = marketId("parlay-b");
      await env.core.createMarket(marketA, closesAt);
      await env.core.createMarket(marketB, closesAt);
      return { ...env, marketA, marketB, closesAt };
    }

    async function placeTwoLegParlay(
      env: Awaited<ReturnType<typeof createTwoOpenMarkets>>,
      bettor: Signer,
      stake: bigint,
      combinedOddsX1000: bigint,
    ): Promise<string> {
      await env.usdc_.connect(bettor).approve(await env.core.getAddress(), stake);
      const tx = await env.core
        .connect(bettor)
        .placeParlayBet(
          [env.marketA, env.marketB],
          [0, 0],
          stake,
          combinedOddsX1000,
          combinedOddsX1000,
        );
      const r = await tx.wait();
      const log = r!.logs.find((l) => {
        try { return env.core.interface.parseLog(l)?.name === "ParlayPlaced"; }
        catch { return false; }
      });
      return env.core.interface.parseLog(log!)!.args[0] as string;
    }

    it("locks shared-pool collateral for potentialPayout - stake, keyed by parlayId", async () => {
      const env = await loadFixture(createTwoOpenMarkets);
      await seedPool(env, env.lp1, usdc(10_000));

      const stake = usdc(50);
      const odds = 4_000n; // 4x combined
      const parlayId = await placeTwoLegParlay(env, env.bettor1, stake, odds);

      const expectedLock = (stake * odds) / ODDS_DENOM - stake;
      expect(await env.pool.marketLocked(parlayId)).to.equal(expectedLock);
      expect(await env.pool.lockedForPayouts()).to.equal(expectedLock);

      const p = await env.core.getParlay(parlayId);
      expect(p.bettor).to.equal(env.bettor1.address);
      expect(p.stake).to.equal(stake);
      expect(await env.core.getParlayVerdict(parlayId)).to.equal(0); // Pending
    });

    it("pays out when every leg wins, releasing the pool lock", async () => {
      const env = await loadFixture(createTwoOpenMarkets);
      await seedPool(env, env.lp1, usdc(10_000));

      const stake = usdc(50);
      const odds = 4_000n;
      const parlayId = await placeTwoLegParlay(env, env.bettor1, stake, odds);
      const payout = (stake * odds) / ODDS_DENOM;

      await env.core.settleMarket(env.marketA, 0, [], 0);
      await env.core.settleMarket(env.marketB, 0, [], 0);

      expect(await env.core.getParlayVerdict(parlayId)).to.equal(1); // Won

      const before = await env.usdc_.balanceOf(env.bettor1.address);
      await env.core.connect(env.bettor1).claimParlayWinnings(parlayId);
      const after = await env.usdc_.balanceOf(env.bettor1.address);
      expect(after - before).to.equal(payout);

      expect(await env.pool.marketLocked(parlayId)).to.equal(0n);
      expect(await env.pool.lockedForPayouts()).to.equal(0n);
    });

    it("claimParlayWinnings scales payout when pool is short", async () => {
      const env = await loadFixture(createTwoOpenMarkets);
      await seedPool(env, env.lp1, usdc(1000));

      const stake = usdc(50);
      const odds = 4_000n; // 4x
      const parlayId = await placeTwoLegParlay(env, env.bettor1, stake, odds);
      const quoted = (stake * odds) / ODDS_DENOM; // 200 USDC

      // Settle both legs as won
      await env.core.settleMarket(env.marketA, 0, [], 0);
      await env.core.settleMarket(env.marketB, 0, [], 0);

      // Drain pool to force scaling: deficit = 200 - 50 = 150
      const poolAddr = await env.pool.getAddress();
      await ethers.provider.send("hardhat_setBalance", [poolAddr, "0x1000000000000000000"]);
      const poolSigner = await ethers.getImpersonatedSigner(poolAddr);
      const poolBal = await env.usdc_.balanceOf(poolAddr);
      // Leave only 100 USDC in pool — available < deficit (150)
      await env.usdc_.connect(poolSigner).transfer(env.admin.address, poolBal - usdc(100));

      // covered = min(150, 100) = 100, payout = 50 + 100 = 150
      const before = await env.usdc_.balanceOf(env.bettor1.address);
      await env.core.connect(env.bettor1).claimParlayWinnings(parlayId);
      const after = await env.usdc_.balanceOf(env.bettor1.address);

      // Payout should be between stake (50) and quoted (200), specifically 150
      const actualPayout = after - before;
      expect(actualPayout).to.equal(usdc(150));
      expect(actualPayout).to.be.greaterThan(stake);
      expect(actualPayout).to.be.lessThan(quoted);
    });

    it("blocks the winnings claim as soon as one leg is confirmed lost, even if the other leg is still open", async () => {
      const env = await loadFixture(createTwoOpenMarkets);
      await seedPool(env, env.lp1, usdc(10_000));

      const parlayId = await placeTwoLegParlay(env, env.bettor1, usdc(50), 4_000n);

      // Leg A settles for outcome 1 — the parlay bet on outcome 0. Leg B
      // (marketB) is left open/unsettled.
      await env.core.settleMarket(env.marketA, 1, [], 0);

      expect(await env.core.getParlayVerdict(parlayId)).to.equal(2); // Lost
      await expect(env.core.connect(env.bettor1).claimParlayWinnings(parlayId))
        .to.be.revertedWithCustomError(env.core, "ParlayNotWon");
    });

    it("reportParlayLoss releases the lock and splits the stake between pool and treasury", async () => {
      const env = await loadFixture(createTwoOpenMarkets);
      await seedPool(env, env.lp1, usdc(10_000));

      const stake = usdc(50);
      const parlayId = await placeTwoLegParlay(env, env.bettor1, stake, 4_000n);

      await env.core.settleMarket(env.marketA, 1, [], 0); // bettor picked 0, lost
      await env.core.settleMarket(env.marketB, 0, [], 0);

      const treasuryBefore = await env.usdc_.balanceOf(env.treasury.address);
      // Permissionless — anyone can call it, not just the bettor or operator.
      await env.core.connect(env.bettor2).reportParlayLoss(parlayId);
      const treasuryAfter = await env.usdc_.balanceOf(env.treasury.address);

      const edge = (stake * 200n) / BPS; // default 2% house edge
      expect(treasuryAfter - treasuryBefore).to.equal(edge);
      expect(await env.pool.marketLocked(parlayId)).to.equal(0n);
      expect(await env.pool.lockedForPayouts()).to.equal(0n);

      const p = await env.core.getParlay(parlayId);
      expect(p.status).to.equal(2); // Lost
    });

    it("refunds the stake when a leg's market is cancelled and no other leg has lost", async () => {
      const env = await loadFixture(createTwoOpenMarkets);
      await seedPool(env, env.lp1, usdc(10_000));

      const stake = usdc(50);
      const parlayId = await placeTwoLegParlay(env, env.bettor1, stake, 4_000n);

      await env.core.settleMarket(env.marketA, 0, [], 0); // won
      await env.core.cancelMarket(env.marketB); // voided

      expect(await env.core.getParlayVerdict(parlayId)).to.equal(3); // Void

      const before = await env.usdc_.balanceOf(env.bettor1.address);
      await env.core.connect(env.bettor1).claimParlayRefund(parlayId);
      const after = await env.usdc_.balanceOf(env.bettor1.address);
      expect(after - before).to.equal(stake);
      expect(await env.pool.marketLocked(parlayId)).to.equal(0n);
    });

    it("reverts on a duplicate market across legs", async () => {
      const env = await loadFixture(createTwoOpenMarkets);
      await seedPool(env, env.lp1, usdc(10_000));
      const stake = usdc(50);
      await env.usdc_.connect(env.bettor1).approve(await env.core.getAddress(), stake);
      await expect(
        env.core
          .connect(env.bettor1)
          .placeParlayBet([env.marketA, env.marketA], [0, 1], stake, 4_000n, 4_000n),
      ).to.be.revertedWithCustomError(env.core, "DuplicateMarketInParlay");
    });

    it("reverts with fewer than 2 legs", async () => {
      const env = await loadFixture(createTwoOpenMarkets);
      await seedPool(env, env.lp1, usdc(10_000));
      const stake = usdc(50);
      await env.usdc_.connect(env.bettor1).approve(await env.core.getAddress(), stake);
      await expect(
        env.core.connect(env.bettor1).placeParlayBet([env.marketA], [0], stake, 4_000n, 4_000n),
      ).to.be.revertedWithCustomError(env.core, "TooFewLegs");
    });

    it("reverts past MAX_PARLAY_LEGS", async () => {
      const env = await loadFixture(createTwoOpenMarkets);
      await seedPool(env, env.lp1, usdc(10_000));
      const stake = usdc(50);
      await env.usdc_.connect(env.bettor1).approve(await env.core.getAddress(), stake);
      const marketIds = Array.from({ length: 11 }, () => env.marketA);
      const outcomes = Array.from({ length: 11 }, () => 0);
      await expect(
        env.core.connect(env.bettor1).placeParlayBet(marketIds, outcomes, stake, 4_000n, 4_000n),
      ).to.be.revertedWithCustomError(env.core, "TooManyLegs");
    });
  });

  describe("UUPS upgrade", () => {
    it("only DEFAULT_ADMIN_ROLE can authorize an upgrade", async () => {
      const env = await loadFixture(deploy);
      await expect(
        env.core.connect(env.lp1).upgradeToAndCall(await env.core.getAddress(), "0x")
      ).to.be.reverted;
    });
  });

  describe("attestation-based market creation", () => {
    async function deployV2() {
      const env = await deploy();
      const oracleSigner = ethers.Wallet.createRandom();
      await env.core.connect(env.admin).initializeV2(oracleSigner.address);
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const coreAddress = await env.core.getAddress();
      return { ...env, oracleSigner, chainId, coreAddress };
    }

    async function signAttestation(
      signer: InstanceType<typeof ethers.Wallet>,
      coreAddress: string,
      chainId: bigint,
      marketIdHex: string,
      closesAt: number,
      validUntil: number,
    ): Promise<string> {
      const domain = { name: "BettingCore", version: "1", chainId, verifyingContract: coreAddress };
      const types = {
        MarketAttestation: [
          { name: "marketId", type: "bytes32" },
          { name: "closesAt", type: "uint64" },
          { name: "validUntil", type: "uint64" },
        ],
      };
      return signer.signTypedData(domain, types, { marketId: marketIdHex, closesAt, validUntil });
    }

    it("initializeV2 grants ORACLE_SIGNER_ROLE and cannot be run twice", async () => {
      const env = await loadFixture(deployV2);
      expect(await env.core.hasRole(await env.core.ORACLE_SIGNER_ROLE(), env.oracleSigner.address)).to.equal(true);
      await expect(env.core.connect(env.admin).initializeV2(env.oracleSigner.address)).to.be.reverted;
    });

    it("initializeV2 reverts for a non-DEFAULT_ADMIN_ROLE caller — closes the front-run window between upgrade and the real init call", async () => {
      const env = await deploy(); // fresh V1 deploy, initializeV2 not yet called
      await expect(
        env.core.connect(env.bettor1).initializeV2(env.bettor1.address),
      ).to.be.reverted;
      expect(await env.core.hasRole(await env.core.ORACLE_SIGNER_ROLE(), env.bettor1.address)).to.equal(false);
    });

    it("placeBetWithAttestation registers an unknown market and places the bet in one tx", async () => {
      const env = await loadFixture(deployV2);
      const id = marketId("fresh-1");
      const closesAt = (await time.latest()) + 3600;
      const validUntil = (await time.latest()) + 600;
      const signature = await signAttestation(env.oracleSigner, env.coreAddress, env.chainId, id, closesAt, validUntil);

      const amount = usdc(20);
      await env.usdc_.connect(env.bettor1).approve(env.coreAddress, amount);
      await expect(
        env.core.connect(env.bettor1).placeBetWithAttestation(0, amount, 2000n, 2000n, {
          marketId: id,
          closesAt,
          validUntil,
          signature,
        }),
      )
        .to.emit(env.core, "MarketCreated")
        .withArgs(id, closesAt)
        .and.to.emit(env.core, "BetPlaced");

      expect((await env.core.markets(id)).status).to.equal(0); // Open
    });

    it("reverts with InvalidOracleSignature for a non-ORACLE_SIGNER_ROLE signer", async () => {
      const env = await loadFixture(deployV2);
      const id = marketId("fresh-2");
      const closesAt = (await time.latest()) + 3600;
      const validUntil = (await time.latest()) + 600;
      // bettor2 holds no role — a validly-formed but wrongly-signed ticket.
      const badSignature = await signAttestation(
        env.bettor2 as unknown as InstanceType<typeof ethers.Wallet>,
        env.coreAddress,
        env.chainId,
        id,
        closesAt,
        validUntil,
      );

      await env.usdc_.connect(env.bettor1).approve(env.coreAddress, usdc(20));
      await expect(
        env.core.connect(env.bettor1).placeBetWithAttestation(0, usdc(20), 2000n, 2000n, {
          marketId: id,
          closesAt,
          validUntil,
          signature: badSignature,
        }),
      ).to.be.revertedWithCustomError(env.core, "InvalidOracleSignature");
    });

    it("reverts with AttestationExpired for a stale validUntil", async () => {
      const env = await loadFixture(deployV2);
      const id = marketId("fresh-3");
      const closesAt = (await time.latest()) + 3600;
      const validUntil = (await time.latest()) - 1;
      const signature = await signAttestation(env.oracleSigner, env.coreAddress, env.chainId, id, closesAt, validUntil);

      await expect(
        env.core.connect(env.bettor1).placeBetWithAttestation(0, usdc(20), 2000n, 2000n, {
          marketId: id,
          closesAt,
          validUntil,
          signature,
        }),
      ).to.be.revertedWithCustomError(env.core, "AttestationExpired");
    });

    it("ignores the attestation entirely once the market already exists", async () => {
      const env = await loadFixture(deployV2);
      const id = marketId("fresh-4");
      const closesAt = (await time.latest()) + 3600;
      await env.core.connect(env.admin).createMarket(id, closesAt);

      await env.usdc_.connect(env.bettor1).approve(env.coreAddress, usdc(20));
      // Garbage signature — must be accepted because the market already exists.
      await expect(
        env.core.connect(env.bettor1).placeBetWithAttestation(0, usdc(20), 2000n, 2000n, {
          marketId: id,
          closesAt,
          validUntil: 0,
          signature: "0x00",
        }),
      ).to.emit(env.core, "BetPlaced");
    });

    it("placeParlayBetWithAttestations registers multiple unknown legs atomically", async () => {
      const env = await loadFixture(deployV2);
      await env.usdc_.connect(env.lp1).approve(await env.pool.getAddress(), usdc(10_000));
      await env.pool.connect(env.lp1).deposit(usdc(10_000));

      const closesAt = (await time.latest()) + 3600;
      const validUntil = (await time.latest()) + 600;
      const marketA = marketId("parlay-fresh-a");
      const marketB = marketId("parlay-fresh-b");
      const sigA = await signAttestation(env.oracleSigner, env.coreAddress, env.chainId, marketA, closesAt, validUntil);
      const sigB = await signAttestation(env.oracleSigner, env.coreAddress, env.chainId, marketB, closesAt, validUntil);

      const stake = usdc(50);
      await env.usdc_.connect(env.bettor1).approve(env.coreAddress, stake);
      await expect(
        env.core.connect(env.bettor1).placeParlayBetWithAttestations(
          [marketA, marketB],
          [0, 0],
          stake,
          4000n,
          4000n,
          [
            { marketId: marketA, closesAt, validUntil, signature: sigA },
            { marketId: marketB, closesAt, validUntil, signature: sigB },
          ],
        ),
      ).to.emit(env.core, "ParlayPlaced");

      expect((await env.core.markets(marketA)).status).to.equal(0);
      expect((await env.core.markets(marketB)).status).to.equal(0);
    });

    it("reverts with MarketNotFound if an attestation's marketId doesn't match its positional leg", async () => {
      const env = await loadFixture(deployV2);
      const closesAt = (await time.latest()) + 3600;
      const validUntil = (await time.latest()) + 600;
      const marketA = marketId("mismatch-a");
      const marketB = marketId("mismatch-b");
      const sigA = await signAttestation(env.oracleSigner, env.coreAddress, env.chainId, marketA, closesAt, validUntil);

      await env.usdc_.connect(env.bettor1).approve(env.coreAddress, usdc(50));
      await expect(
        env.core.connect(env.bettor1).placeParlayBetWithAttestations(
          [marketA, marketB],
          [0, 0],
          usdc(50),
          4000n,
          4000n,
          [
            { marketId: marketA, closesAt, validUntil, signature: sigA },
            { marketId: marketA, closesAt, validUntil, signature: sigA }, // wrong marketId for leg B
          ],
        ),
      ).to.be.revertedWithCustomError(env.core, "MarketNotFound");
    });

    it("reverts with LegCountMismatch when attestations array length differs from marketIds", async () => {
      const env = await loadFixture(deployV2);
      const marketA = marketId("lencheck-a");
      const marketB = marketId("lencheck-b");
      await expect(
        env.core.connect(env.bettor1).placeParlayBetWithAttestations(
          [marketA, marketB],
          [0, 0],
          usdc(50),
          4000n,
          4000n,
          [{ marketId: marketA, closesAt: 0, validUntil: 0, signature: "0x00" }],
        ),
      ).to.be.revertedWithCustomError(env.core, "LegCountMismatch");
    });
  });
});
