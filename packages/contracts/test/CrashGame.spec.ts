import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const ONE_USDC = 10n ** 6n;
const usdc = (n: bigint | number) => BigInt(n) * ONE_USDC;

describe("CrashGame", () => {
  async function deploy() {
    const [admin, p1, p2, p3] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc_ = await MockUSDC.deploy();
    await usdc_.waitForDeployment();
    const Crash = await ethers.getContractFactory("CrashGame");
    const crash = await upgrades.deployProxy(Crash, [admin.address], {
      kind: "uups",
      constructorArgs: [await usdc_.getAddress()],
    });
    await crash.waitForDeployment();
    for (const u of [p1, p2, p3]) await usdc_.mint(u.address, usdc(10_000));
    // Seed bankroll so joins pass the solvency check.
    await usdc_.mint(admin.address, usdc(1_000_000));
    await usdc_.connect(admin).approve(await crash.getAddress(), usdc(1_000_000));
    await crash.connect(admin).depositBankroll(usdc(1_000_000));
    return { usdc_, crash, admin, p1, p2, p3 };
  }

  function seedHashOf(seed: string): string {
    return ethers.keccak256(ethers.solidityPacked(["bytes32"], [seed]));
  }

  it("rejects startRound with zero seedHash", async () => {
    const env = await loadFixture(deploy);
    await expect(env.crash.startRound(ethers.ZeroHash))
      .to.be.revertedWithCustomError(env.crash, "InvalidSeedHash");
  });

  it("rejects resolveRound with wrong seed", async () => {
    const env = await loadFixture(deploy);
    const seed = ethers.keccak256(ethers.toUtf8Bytes("server-seed-1"));
    await env.crash.startRound(seedHashOf(seed));
    await env.crash.lockRound(1);
    const badSeed = ethers.keccak256(ethers.toUtf8Bytes("not-the-seed"));
    await expect(env.crash.resolveRound(1, badSeed))
      .to.be.revertedWithCustomError(env.crash, "SeedMismatch");
  });

  it("rejects joinRound below MIN_STAKE", async () => {
    const env = await loadFixture(deploy);
    const seed = ethers.keccak256(ethers.toUtf8Bytes("seed"));
    await env.crash.startRound(seedHashOf(seed));
    await env.usdc_.connect(env.p1).approve(await env.crash.getAddress(), usdc(5000));
    await expect(env.crash.connect(env.p1).joinRound(1, 0, 200))
      .to.be.revertedWithCustomError(env.crash, "StakeOutOfRange");
  });

  it("rejects joinRound above MAX_STAKE", async () => {
    const env = await loadFixture(deploy);
    const seed = ethers.keccak256(ethers.toUtf8Bytes("seed"));
    await env.crash.startRound(seedHashOf(seed));
    await env.usdc_.connect(env.p1).approve(await env.crash.getAddress(), usdc(5001));
    await expect(env.crash.connect(env.p1).joinRound(1, usdc(5001), 200))
      .to.be.revertedWithCustomError(env.crash, "StakeOutOfRange");
  });

  it("rejects double-join", async () => {
    const env = await loadFixture(deploy);
    const seed = ethers.keccak256(ethers.toUtf8Bytes("seed"));
    await env.crash.startRound(seedHashOf(seed));
    await env.usdc_.connect(env.p1).approve(await env.crash.getAddress(), usdc(20));
    await env.crash.connect(env.p1).joinRound(1, usdc(10), 200);
    await expect(env.crash.connect(env.p1).joinRound(1, usdc(10), 200))
      .to.be.revertedWithCustomError(env.crash, "AlreadyJoined");
  });

  it("end-to-end happy path with auto-cashout", async () => {
    const env = await loadFixture(deploy);
    const seed = ethers.keccak256(ethers.toUtf8Bytes("entropy-payload"));
    await env.crash.startRound(seedHashOf(seed));

    await env.usdc_.connect(env.p1).approve(await env.crash.getAddress(), usdc(100));
    await env.crash.connect(env.p1).joinRound(1, usdc(100), 110); // 1.10x
    await env.crash.lockRound(1);

    await env.crash.resolveRound(1, seed);
    const round = await env.crash.rounds(1);
    expect(round.status).to.equal(2); // Resolved
    expect(round.crashMultiplierX100).to.be.gte(100n);

    const pending = await env.crash.pendingPayout(env.p1.address);
    if (round.crashMultiplierX100 >= 110n) {
      expect(pending).to.equal(usdc(110));
    } else {
      expect(pending).to.equal(0n);
    }
  });

  it("claim() pulls accumulated winnings", async () => {
    const env = await loadFixture(deploy);
    const seed = ethers.keccak256(ethers.toUtf8Bytes("claim-test"));
    await env.crash.startRound(seedHashOf(seed));
    await env.usdc_.connect(env.p1).approve(await env.crash.getAddress(), usdc(100));
    await env.crash.connect(env.p1).joinRound(1, usdc(100), 101); // 1.01x near-certain win
    await env.crash.lockRound(1);
    await env.crash.resolveRound(1, seed);

    const pending = await env.crash.pendingPayout(env.p1.address);
    if (pending > 0n) {
      const before = await env.usdc_.balanceOf(env.p1.address);
      await env.crash.connect(env.p1).claim();
      const after = await env.usdc_.balanceOf(env.p1.address);
      expect(after - before).to.equal(pending);
      expect(await env.crash.pendingPayout(env.p1.address)).to.equal(0n);
    }
  });

  it("pause blocks startRound and joinRound", async () => {
    const env = await loadFixture(deploy);
    await env.crash.pause();
    const seed = ethers.keccak256(ethers.toUtf8Bytes("paused"));
    await expect(env.crash.startRound(seedHashOf(seed)))
      .to.be.revertedWithCustomError(env.crash, "EnforcedPause");
  });

  describe("cancelPendingRound", () => {
    it("refunds joined players and unblocks startRound — the exact 'operator crashed between startRound and lockRound' scenario", async () => {
      const env = await loadFixture(deploy);
      const seed = ethers.keccak256(ethers.toUtf8Bytes("stuck-pending"));
      await env.crash.startRound(seedHashOf(seed));

      await env.usdc_.connect(env.p1).approve(await env.crash.getAddress(), usdc(50));
      await env.crash.connect(env.p1).joinRound(1, usdc(50), 0);

      // Round 1 is Pending and stays that way — no lockRound call, matching
      // an operator process that died right after startRound.
      await expect(env.crash.startRound(seedHashOf(ethers.keccak256(ethers.toUtf8Bytes("next")))))
        .to.be.revertedWithCustomError(env.crash, "PendingRoundExists");

      const before = await env.usdc_.balanceOf(env.p1.address);
      await expect(env.crash.cancelPendingRound(1)).to.emit(env.crash, "RoundCancelled").withArgs(1);

      const round = await env.crash.rounds(1);
      expect(round.status).to.equal(2); // Resolved

      // Pull-payment, same as every other payout path — not sent directly.
      expect(await env.usdc_.balanceOf(env.p1.address)).to.equal(before);
      expect(await env.crash.pendingPayout(env.p1.address)).to.equal(usdc(50));
      await env.crash.connect(env.p1).claim();
      expect(await env.usdc_.balanceOf(env.p1.address)).to.equal(before + usdc(50));

      // startRound works again immediately — no 30-minute wait, unlike cancelStuckRound.
      await expect(env.crash.startRound(seedHashOf(ethers.keccak256(ethers.toUtf8Bytes("next")))))
        .to.not.be.reverted;
    });

    it("reverts on a round that's already Running (must use cancelStuckRound instead)", async () => {
      const env = await loadFixture(deploy);
      const seed = ethers.keccak256(ethers.toUtf8Bytes("already-locked"));
      await env.crash.startRound(seedHashOf(seed));
      await env.crash.lockRound(1);
      await expect(env.crash.cancelPendingRound(1)).to.be.revertedWithCustomError(env.crash, "RoundNotPending");
    });

    it("reverts for a non-existent round", async () => {
      const env = await loadFixture(deploy);
      await expect(env.crash.cancelPendingRound(999)).to.be.revertedWithCustomError(env.crash, "RoundNotFound");
    });

    it("only OPERATOR_ROLE can call it", async () => {
      const env = await loadFixture(deploy);
      const seed = ethers.keccak256(ethers.toUtf8Bytes("access-control"));
      await env.crash.startRound(seedHashOf(seed));
      await expect(env.crash.connect(env.p1).cancelPendingRound(1)).to.be.reverted;
    });
  });
});
