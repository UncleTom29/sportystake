import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const ONE_USDC = 10n ** 6n;
const usdc = (n: bigint | number) => BigInt(n) * ONE_USDC;

function marketId(label: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

describe("LiquidityPool", () => {
  async function deploy() {
    const [admin, lp1, lp2, rando, bettingCoreImposter] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc_ = await MockUSDC.deploy();
    await usdc_.waitForDeployment();

    const Pool = await ethers.getContractFactory("LiquidityPool");
    const pool = await upgrades.deployProxy(Pool, [admin.address], {
      kind: "uups",
      constructorArgs: [await usdc_.getAddress()],
    });
    await pool.waitForDeployment();

    await pool.connect(admin).setBettingCore(bettingCoreImposter.address);

    for (const u of [lp1, lp2, rando, admin]) await usdc_.mint(u.address, usdc(1_000_000));

    return { usdc_, pool, admin, lp1, lp2, rando, bettingCoreImposter };
  }

  describe("permissionless deposits", () => {
    it("rejects deposit below MIN_DEPOSIT", async () => {
      const env = await loadFixture(deploy);
      await env.usdc_.connect(env.lp1).approve(await env.pool.getAddress(), 5n * ONE_USDC);
      await expect(env.pool.connect(env.lp1).deposit(5n * ONE_USDC))
        .to.be.revertedWithCustomError(env.pool, "DepositTooSmall");
    });

    it("mints shares 1:1 on first deposit", async () => {
      const env = await loadFixture(deploy);
      await env.usdc_.connect(env.lp1).approve(await env.pool.getAddress(), usdc(1000));
      await env.pool.connect(env.lp1).deposit(usdc(1000));
      expect(await env.pool.shares(env.lp1.address)).to.equal(usdc(1000));
      expect(await env.pool.totalLiquidity()).to.equal(usdc(1000));
    });

    it("allows any address to deposit — no allowlist, no role required", async () => {
      const env = await loadFixture(deploy);
      // `rando` holds no role of any kind on the pool.
      await env.usdc_.connect(env.rando).approve(await env.pool.getAddress(), usdc(50));
      await expect(env.pool.connect(env.rando).deposit(usdc(50))).to.not.be.reverted;
      expect(await env.pool.shares(env.rando.address)).to.equal(usdc(50));
    });

    it("mints proportional shares once the pool has accrued value", async () => {
      const env = await loadFixture(deploy);
      await env.usdc_.connect(env.lp1).approve(await env.pool.getAddress(), usdc(1000));
      await env.pool.connect(env.lp1).deposit(usdc(1000));

      // Simulate a market win pushed into the pool without minting shares
      // (as reportMarketResult would do via a real balance increase).
      await env.usdc_.connect(env.admin).transfer(await env.pool.getAddress(), usdc(1000));
      await env.pool.connect(env.bettingCoreImposter).reportMarketResult(marketId("m"), 0, 0);
      expect(await env.pool.getShareValue()).to.equal(2n * 10n ** 18n); // 2000/1000

      await env.usdc_.connect(env.lp2).approve(await env.pool.getAddress(), usdc(200));
      await env.pool.connect(env.lp2).deposit(usdc(200));
      // 200 USDC at share value 2.0 → 100 shares.
      expect(await env.pool.shares(env.lp2.address)).to.equal(usdc(100));
    });
  });

  describe("lock/unlock — bettingCore only, per market", () => {
    it("rejects lock/unlock from anyone but bettingCore", async () => {
      const env = await loadFixture(deploy);
      await env.usdc_.connect(env.lp1).approve(await env.pool.getAddress(), usdc(1000));
      await env.pool.connect(env.lp1).deposit(usdc(1000));

      await expect(env.pool.connect(env.lp1).lockLiquidity(marketId("m"), usdc(100)))
        .to.be.revertedWithCustomError(env.pool, "OnlyBettingCore");
    });

    it("locks liquidity without hard utilization cap rejection", async () => {
      const env = await loadFixture(deploy);
      await env.usdc_.connect(env.lp1).approve(await env.pool.getAddress(), usdc(1000));
      await env.pool.connect(env.lp1).deposit(usdc(1000));
      await env.pool.connect(env.bettingCoreImposter).lockLiquidity(marketId("m"), usdc(800));
      await env.pool.connect(env.bettingCoreImposter).lockLiquidity(marketId("m"), usdc(500));
      expect(await env.pool.lockedForPayouts()).to.equal(usdc(1300));
    });

    it("tracks two concurrent markets independently against the same shared pool", async () => {
      const env = await loadFixture(deploy);
      await env.usdc_.connect(env.lp1).approve(await env.pool.getAddress(), usdc(10_000));
      await env.pool.connect(env.lp1).deposit(usdc(10_000));

      const marketA = marketId("A");
      const marketB = marketId("B");

      await env.pool.connect(env.bettingCoreImposter).lockLiquidity(marketA, usdc(1000));
      await env.pool.connect(env.bettingCoreImposter).lockLiquidity(marketB, usdc(2000));

      expect(await env.pool.marketLocked(marketA)).to.equal(usdc(1000));
      expect(await env.pool.marketLocked(marketB)).to.equal(usdc(2000));
      expect(await env.pool.lockedForPayouts()).to.equal(usdc(3000));

      // Settling market A with a net loss must not disturb market B's lock.
      await env.pool.connect(env.bettingCoreImposter).reportMarketResult(
        marketA,
        usdc(500), // totalBetAmount
        usdc(1500), // totalPayoutRequired (pool loses 1000)
      );

      expect(await env.pool.marketLocked(marketA)).to.equal(0n);
      expect(await env.pool.marketLocked(marketB)).to.equal(usdc(2000));
      expect(await env.pool.lockedForPayouts()).to.equal(usdc(2000));
      expect(await env.pool.totalLiquidity()).to.equal(usdc(9000)); // 10,000 - 1,000 deficit
    });
  });

  describe("virtual liquidity (display-only, not real USDC)", () => {
    it("only ADMIN_ROLE can add/remove virtual liquidity", async () => {
      const env = await loadFixture(deploy);
      await expect(env.pool.connect(env.lp1).addVirtualLiquidity(usdc(100)))
        .to.be.reverted;
    });

    it("adding/removing requires no USDC approval or balance — it's a bare counter", async () => {
      const env = await loadFixture(deploy);
      // env.admin holds/approves nothing here; if this pulled real USDC the
      // transferFrom would revert for lack of allowance.
      await expect(env.pool.connect(env.admin).addVirtualLiquidity(usdc(100_000)))
        .to.not.be.reverted;
      expect(await env.pool.virtualLiquidity()).to.equal(usdc(100_000));
    });

    it("extends effective capacity but never real free liquidity", async () => {
      const env = await loadFixture(deploy);
      await env.usdc_.connect(env.lp1).approve(await env.pool.getAddress(), usdc(1000));
      await env.pool.connect(env.lp1).deposit(usdc(1000));

      await env.pool.connect(env.admin).addVirtualLiquidity(usdc(500));
      expect(await env.pool.getEffectiveCapacity()).to.equal(usdc(1500)); // cosmetic figure

      // getFreeLiquidity is real-balance-only — the 500 virtual credit must
      // never appear here, since BettingCore's fill-ratio math relies on
      // this to bound actual payouts to what the pool can really pay.
      expect(await env.pool.getFreeLiquidity(marketId("m"))).to.equal(usdc(1000));
    });

    it("does not mint shares and is excluded from share value", async () => {
      const env = await loadFixture(deploy);
      await env.usdc_.connect(env.lp1).approve(await env.pool.getAddress(), usdc(1000));
      await env.pool.connect(env.lp1).deposit(usdc(1000));

      await env.pool.connect(env.admin).addVirtualLiquidity(usdc(500));

      expect(await env.pool.shares(env.admin.address)).to.equal(0n);
      expect(await env.pool.getShareValue()).to.equal(10n ** 18n); // unchanged, 1.0
    });

    it("is left untouched by settlement — deficits always draw from real liquidity", async () => {
      const env = await loadFixture(deploy);
      await env.usdc_.connect(env.lp1).approve(await env.pool.getAddress(), usdc(1000));
      await env.pool.connect(env.lp1).deposit(usdc(1000));

      await env.pool.connect(env.admin).addVirtualLiquidity(usdc(300));

      const m = marketId("loss-market");
      await env.pool.connect(env.bettingCoreImposter).lockLiquidity(m, usdc(200));
      await env.pool.connect(env.bettingCoreImposter).reportMarketResult(m, usdc(0), usdc(200));

      // Deficit of 200 comes entirely out of real totalLiquidity — the
      // cosmetic virtual figure never moves on its own.
      expect(await env.pool.totalLiquidity()).to.equal(usdc(800)); // 1000 - 200
      expect(await env.pool.virtualLiquidity()).to.equal(usdc(300)); // untouched
    });

    it("removeVirtualLiquidity is a free counter decrement — no utilization check", async () => {
      const env = await loadFixture(deploy);
      await env.usdc_.connect(env.lp1).approve(await env.pool.getAddress(), usdc(1000));
      await env.pool.connect(env.lp1).deposit(usdc(1000));

      await env.pool.connect(env.admin).addVirtualLiquidity(usdc(500));

      // Even with heavy locks against the pool, removing the entire virtual
      // credit succeeds — it never gated capacity to begin with.
      await env.pool.connect(env.bettingCoreImposter).lockLiquidity(marketId("m"), usdc(900));
      await expect(env.pool.connect(env.admin).removeVirtualLiquidity(usdc(500))).to.not.be.reverted;
      expect(await env.pool.virtualLiquidity()).to.equal(0n);
    });

    it("removeVirtualLiquidity still rejects removing more than the credit holds", async () => {
      const env = await loadFixture(deploy);
      await env.pool.connect(env.admin).addVirtualLiquidity(usdc(100));
      await expect(env.pool.connect(env.admin).removeVirtualLiquidity(usdc(101)))
        .to.be.revertedWithCustomError(env.pool, "InsufficientVirtualLiquidity");
    });
  });

  describe("withdrawals", () => {
    it("requires request → timelock → execute, valued at live share price", async () => {
      const env = await loadFixture(deploy);
      await env.usdc_.connect(env.lp1).approve(await env.pool.getAddress(), usdc(1000));
      await env.pool.connect(env.lp1).deposit(usdc(1000));

      await expect(env.pool.connect(env.lp1).executeWithdrawal())
        .to.be.revertedWithCustomError(env.pool, "WithdrawalNotRequested");

      await env.pool.connect(env.lp1).requestWithdrawal();
      await expect(env.pool.connect(env.lp1).executeWithdrawal())
        .to.be.revertedWithCustomError(env.pool, "WithdrawalTimelockActive");

      await time.increase(48 * 3600 + 1);
      const before = await env.usdc_.balanceOf(env.lp1.address);
      await env.pool.connect(env.lp1).executeWithdrawal();
      const after = await env.usdc_.balanceOf(env.lp1.address);
      expect(after - before).to.equal(usdc(1000));
    });

    it("blocks withdrawal of currently-locked liquidity", async () => {
      const env = await loadFixture(deploy);
      await env.usdc_.connect(env.lp1).approve(await env.pool.getAddress(), usdc(1000));
      await env.pool.connect(env.lp1).deposit(usdc(1000));
      await env.pool.connect(env.bettingCoreImposter).lockLiquidity(marketId("m"), usdc(800));

      await env.pool.connect(env.lp1).requestWithdrawal();
      await time.increase(48 * 3600 + 1);
      await expect(env.pool.connect(env.lp1).executeWithdrawal())
        .to.be.revertedWithCustomError(env.pool, "InsufficientUnlockedLiquidity");
    });
  });

  describe("UUPS upgrade", () => {
    it("only DEFAULT_ADMIN_ROLE can authorize an upgrade", async () => {
      const env = await loadFixture(deploy);
      const V2 = await ethers.getContractFactory("LiquidityPoolV2Mock", env.lp1);
      const v2Impl = await V2.deploy(await env.usdc_.getAddress());
      await v2Impl.waitForDeployment();

      await expect(
        env.pool.connect(env.lp1).upgradeToAndCall(await v2Impl.getAddress(), "0x")
      ).to.be.reverted;
    });

    it("preserves storage across an upgrade", async () => {
      const env = await loadFixture(deploy);
      await env.usdc_.connect(env.lp1).approve(await env.pool.getAddress(), usdc(1234));
      await env.pool.connect(env.lp1).deposit(usdc(1234));

      const V2 = await ethers.getContractFactory("LiquidityPoolV2Mock", env.admin);
      const upgraded = await upgrades.upgradeProxy(await env.pool.getAddress(), V2, {
        constructorArgs: [await env.usdc_.getAddress()],
        // V2Mock adds no state and reuses LiquidityPool's initializer — there
        // is nothing new to initialize on upgrade.
        unsafeAllow: ["missing-initializer"],
      });

      expect(await upgraded.totalLiquidity()).to.equal(usdc(1234));
      expect(await upgraded.shares(env.lp1.address)).to.equal(usdc(1234));
      expect(await (upgraded as any).version()).to.equal("v2-mock");
    });
  });
});
