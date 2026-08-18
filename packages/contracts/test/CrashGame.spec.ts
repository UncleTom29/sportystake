import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyUint } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

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
      // Same two-phase-initializer validator gap as CasinoHouse/BettingCore.
      unsafeAllow: ["missing-initializer-call", "incorrect-initializer-order"],
    });
    await crash.waitForDeployment();
    await crash.connect(admin).initializeV2(9000n); // 90% RTP / 10% edge default
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

  describe("rtpBps", () => {
    it("defaults to 9000 (90% RTP) via initializeV2 in the test fixture", async () => {
      const env = await loadFixture(deploy);
      expect(await env.crash.rtpBps()).to.equal(9000n);
    });

    it("initializeV2 cannot be run twice", async () => {
      const env = await loadFixture(deploy);
      await expect(env.crash.connect(env.admin).initializeV2(9000n)).to.be.reverted;
    });

    it("setRtp updates the value and emits an event", async () => {
      const env = await loadFixture(deploy);
      await expect(env.crash.connect(env.admin).setRtp(8500n))
        .to.emit(env.crash, "RtpUpdated")
        .withArgs(9000n, 8500n);
      expect(await env.crash.rtpBps()).to.equal(8500n);
    });

    it("reverts below the 50% floor", async () => {
      const env = await loadFixture(deploy);
      await expect(env.crash.connect(env.admin).setRtp(4999n))
        .to.be.revertedWithCustomError(env.crash, "InvalidRtp");
    });

    it("reverts above the 99% cap", async () => {
      const env = await loadFixture(deploy);
      await expect(env.crash.connect(env.admin).setRtp(9901n))
        .to.be.revertedWithCustomError(env.crash, "InvalidRtp");
    });

    it("reverts for a non-ADMIN_ROLE caller", async () => {
      const env = await loadFixture(deploy);
      await expect(env.crash.connect(env.p1).setRtp(8500n)).to.be.reverted;
    });

    it("changing rtpBps changes the resolved crash point for an identical (seed, roundId), in direct proportion", async () => {
      // Two independent, freshly-deployed contracts (not two sequential
      // rounds on the same one) so `keccak256(seed, roundId)` — the actual
      // entropy _crashFromSeed mixes — is byte-for-byte identical between
      // the two resolutions, isolating rtpBps as the only variable. crashX100
      // = rtpBps * 1e6 / (100 * (1e6 - e)) is directly proportional to
      // rtpBps for fixed e, so 5000/9000 bps should scale the crash point by
      // the same ratio (verified offline: this seed lands both sides on the
      // smooth-formula branch, not the instant-bust branch, at 240 vs 133).
      const seed = ethers.keccak256(ethers.toUtf8Bytes("rtp-dir-4"));

      const envHigh = await loadFixture(deploy); // rtpBps=9000 default
      await envHigh.crash.startRound(seedHashOf(seed));
      await envHigh.crash.lockRound(1);
      await envHigh.crash.resolveRound(1, seed);
      const crashAt9000 = (await envHigh.crash.rounds(1)).crashMultiplierX100;
      expect(crashAt9000).to.equal(240n);

      const envLow = await loadFixture(deploy);
      await envLow.crash.connect(envLow.admin).setRtp(5000n);
      await envLow.crash.startRound(seedHashOf(seed));
      await envLow.crash.lockRound(1);
      await envLow.crash.resolveRound(1, seed);
      const crashAt5000 = (await envLow.crash.rounds(1)).crashMultiplierX100;
      expect(crashAt5000).to.equal(133n);
    });
  });

  describe("withdrawBankroll", () => {
    it("refuses to dip into an unresolved round's maxPotentialPayout", async () => {
      const env = await loadFixture(deploy);
      const bankrollBefore = await env.usdc_.balanceOf(await env.crash.getAddress());

      const seed = ethers.keccak256(ethers.toUtf8Bytes("withdraw-reserve-check"));
      await env.crash.startRound(seedHashOf(seed));
      await env.usdc_.connect(env.p1).approve(await env.crash.getAddress(), usdc(100));
      await env.crash.connect(env.p1).joinRound(1, usdc(100), 500); // 5x cap

      const bankroll = bankrollBefore + usdc(100); // p1's stake joined the balance
      const round = await env.crash.rounds(1);
      expect(round.maxPotentialPayout).to.equal(usdc(500));

      const unlocked = bankroll - round.maxPotentialPayout;
      await expect(
        env.crash.connect(env.admin).withdrawBankroll(unlocked + usdc(1), env.admin.address)
      ).to.be.revertedWithCustomError(env.crash, "InsufficientBankroll");
      await expect(env.crash.connect(env.admin).withdrawBankroll(unlocked, env.admin.address))
        .to.not.be.reverted;
    });
  });

  describe("totalPendingPayouts (fixes double-counting unclaimed prior winnings)", () => {
    it("a second round's fill-ratio correctly excludes USDC already owed to an unclaimed prior winner", async () => {
      const env = await loadFixture(deploy);
      const crashAddr = await env.crash.getAddress();

      // Drain the bankroll to exactly 80 USDC free.
      await ethers.provider.send("hardhat_setBalance", [crashAddr, "0x1000000000000000000"]);
      const crashSigner = await ethers.getImpersonatedSigner(crashAddr);
      const currentBal = await env.usdc_.balanceOf(crashAddr);
      await env.usdc_.connect(crashSigner).transfer(env.admin.address, currentBal - usdc(80));

      // Round 1: p1 stakes the max (5000 USDC) at autoCashout=101 (1.01x).
      // Verified offline that this seed does NOT land on the instant-bust
      // branch for roundId=1 at the default rtpBps=9000 (resolves to 125,
      // comfortably >= 101) — instant-bust is a real ~10% chance per round
      // at this RTP, so an unverified seed here would make this test flaky.
      const seed1 = ethers.keccak256(ethers.toUtf8Bytes("pending-payouts-round-1-v2"));
      await env.crash.startRound(seedHashOf(seed1));
      await env.usdc_.connect(env.p1).approve(crashAddr, usdc(5000));
      await env.crash.connect(env.p1).joinRound(1, usdc(5000), 101);
      await env.crash.lockRound(1);
      await env.crash.resolveRound(1, seed1);

      // Balance at resolve = 80 + 5000 = 5080; quoted = 5000*1.01 = 5050;
      // 5080 >= 5050 -> full fill ratio. p1 does NOT claim — stays pending.
      const p1Pending = await env.crash.pendingPayout(env.p1.address);
      expect(p1Pending).to.equal(usdc(5050));
      expect(await env.crash.totalPendingPayouts()).to.equal(usdc(5050));

      // Round 2: p2 stakes the max at the same guaranteed-win auto-cashout.
      const seed2 = ethers.keccak256(ethers.toUtf8Bytes("pending-payouts-round-2"));
      await env.crash.startRound(seedHashOf(seed2));
      await env.usdc_.connect(env.p2).approve(crashAddr, usdc(5000));
      await env.crash.connect(env.p2).joinRound(2, usdc(5000), 101);
      await env.crash.lockRound(2);
      await env.crash.resolveRound(2, seed2);

      // Raw balance is now 5080 + 5000 = 10080 — comfortably above the 5050
      // quoted for round 2 alone. Without subtracting p1's still-unclaimed
      // 5050, the old code would have read L=10080, seen 10080 >= 5050, and
      // credited p2 the FULL 5050 — leaving total obligations of 10100
      // against an actual balance of only 10080 (a 20 USDC shortfall that
      // would have made whichever of p1/p2 claims second revert on
      // insufficient contract balance). With the fix, free capacity is
      // 10080 - 5050 = 5030, short of the 5050 quoted, so p2 is correctly
      // scaled down: fillRatio = (5030-5000)*10000/50 = 6000 (60%),
      // payout = 5000 + (50*6000)/10000 = 5030.
      const p2Pending = await env.crash.pendingPayout(env.p2.address);
      expect(p2Pending).to.equal(usdc(5030));

      // Total obligations land exactly on the actual balance — the
      // interpolation is designed to consume all remaining free capacity
      // exactly at the fill-ratio boundary, not merely stay under it.
      const totalOwed = p1Pending + p2Pending;
      const actualBalance = await env.usdc_.balanceOf(crashAddr);
      expect(totalOwed).to.equal(actualBalance);

      // claim() correctly decrements the running total.
      await env.crash.connect(env.p1).claim();
      expect(await env.crash.totalPendingPayouts()).to.equal(p2Pending);
    });
  });

  describe("maxSustainableCrashX100 (pre-hoc solvency cap, computed at lockRound)", () => {
    async function drainTo(env: Awaited<ReturnType<typeof deploy>>, freeAmount: bigint) {
      const addr = await env.crash.getAddress();
      await ethers.provider.send("hardhat_setBalance", [addr, "0x1000000000000000000"]);
      const signer = await ethers.getImpersonatedSigner(addr);
      const bal = await env.usdc_.balanceOf(addr);
      await env.usdc_.connect(signer).transfer(env.admin.address, bal - freeAmount);
    }

    it("healthy bankroll: no cap needed, full natural ceiling preserved (the 'upscale randomness when risk is minimal' case)", async () => {
      const env = await loadFixture(deploy); // default 1,000,000 USDC bankroll
      const seed = ethers.keccak256(ethers.toUtf8Bytes("healthy-round"));
      await env.crash.startRound(seedHashOf(seed));
      await env.usdc_.connect(env.p1).approve(await env.crash.getAddress(), usdc(50));
      await env.crash.connect(env.p1).joinRound(1, usdc(50), 300);

      await expect(env.crash.lockRound(1))
        .to.emit(env.crash, "RoundLocked")
        .withArgs(1, anyUint, 100_000n);
      expect((await env.crash.rounds(1)).maxSustainableCrashX100).to.equal(100_000n);
    });

    it("all-manual players still get a real, non-trivial cap — not the floor, despite no auto-cashout thresholds to test against", async () => {
      // Drain to 1000 USDC free, then p1 joins 500 manually (no
      // auto-cashout). Balance at lock = 1000 + 500 = 1500.
      // available = 1500 * 90% (rtpBps margin) = 1350.
      // Solve 500 * X / 100 <= 1350 -> X <= 270.
      const env = await loadFixture(deploy);
      await drainTo(env, usdc(1000));
      const seed = ethers.keccak256(ethers.toUtf8Bytes("all-manual-round"));
      await env.crash.startRound(seedHashOf(seed));
      await env.usdc_.connect(env.p1).approve(await env.crash.getAddress(), usdc(500));
      await env.crash.connect(env.p1).joinRound(1, usdc(500), 0);

      await env.crash.lockRound(1);
      expect((await env.crash.rounds(1)).maxSustainableCrashX100).to.equal(270n);
    });

    it("a single auto-cashout whale is capped BELOW their own threshold once it's unaffordable — not smeared proportionally toward 1000x the way a naive available/maxPotentialPayout ratio would", async () => {
      // Drain to 5000 USDC free, then p1 joins the max stake (5000) at
      // autoCashoutX100=200 (2x). Balance at lock = 5000 + 5000 = 10000.
      // available = 10000 * 90% = 9000. Once crash reaches 2x, this whale's
      // fixed contribution jumps to 5000*200/100 = 10000, which alone
      // already exceeds the 9000 available — so nowhere at or past 2x is
      // safe. A naive ratio (available/maxPotentialPayout * 1000x =
      // 9000/10000 * 100000 = 90000, i.e. 900x!) would be catastrophically
      // wrong here — it would let the round climb to 900x while owing the
      // whale their full $10,000 the instant it merely touches 2x.
      const env = await loadFixture(deploy);
      await drainTo(env, usdc(5000));
      const seed = ethers.keccak256(ethers.toUtf8Bytes("whale-round"));
      await env.crash.startRound(seedHashOf(seed));
      await env.usdc_.connect(env.p1).approve(await env.crash.getAddress(), usdc(5000));
      await env.crash.connect(env.p1).joinRound(1, usdc(5000), 200);

      await env.crash.lockRound(1);
      expect((await env.crash.rounds(1)).maxSustainableCrashX100).to.equal(199n);
    });

    it("mixed auto-cashout + manual players: the segment walk combines a step (auto) and a linear (manual) contribution correctly", async () => {
      // Drain to 3000, p1 joins 1000 at autoCashoutX100=300 (3x, fixed
      // contribution 3000 once activated), p2 joins 200 manually. Balance
      // at lock = 3000 + 1000 + 200 = 4200. available = 4200*90% = 3780.
      // Below 3x: liability is purely p2's linear term (tiny, safe all the
      // way to 299). At/above 3x: liability = 3000 (p1, now fixed) +
      // manual term. Solve 3000 + 200*X/100 <= 3780 -> X <= 390.
      const env = await loadFixture(deploy);
      await drainTo(env, usdc(3000));
      const seed = ethers.keccak256(ethers.toUtf8Bytes("mixed-round"));
      await env.crash.startRound(seedHashOf(seed));
      await env.usdc_.connect(env.p1).approve(await env.crash.getAddress(), usdc(1000));
      await env.crash.connect(env.p1).joinRound(1, usdc(1000), 300);
      await env.usdc_.connect(env.p2).approve(await env.crash.getAddress(), usdc(200));
      await env.crash.connect(env.p2).joinRound(1, usdc(200), 0);

      await env.crash.lockRound(1);
      expect((await env.crash.rounds(1)).maxSustainableCrashX100).to.equal(390n);
    });

    it("end-to-end: the whale never wins (capped below their threshold), a small player who cashed out early is paid in FULL with zero post-hoc scaling — even though the round's natural, uncapped trajectory (11.18x) would have made the whale's win real and unaffordable", async () => {
      const env = await loadFixture(deploy);
      await drainTo(env, usdc(5000));
      // Verified offline: this seed's natural (uncapped) crash for roundId=1
      // at rtpBps=9000 is 1118 (11.18x) — comfortably past both the 2x whale
      // threshold and the round's computed cap, so the cap is what actually
      // determines the outcome, not a lucky low natural roll.
      const seed = ethers.keccak256(ethers.toUtf8Bytes("e2e-whale-cap-1"));
      await env.crash.startRound(seedHashOf(seed));

      await env.usdc_.connect(env.p1).approve(await env.crash.getAddress(), usdc(5000));
      await env.crash.connect(env.p1).joinRound(1, usdc(5000), 200); // whale, 2x auto-cashout
      await env.usdc_.connect(env.p2).approve(await env.crash.getAddress(), usdc(10));
      await env.crash.connect(env.p2).joinRound(1, usdc(10), 0); // small, manual

      await env.crash.lockRound(1);
      expect((await env.crash.rounds(1)).maxSustainableCrashX100).to.equal(199n);

      await env.crash.connect(env.p2).cashOut(1, 150); // 1.50x, well inside the safe zone

      await env.crash.resolveRound(1, seed);
      const round = await env.crash.rounds(1);
      expect(round.crashMultiplierX100).to.equal(199n); // capped, not the natural 1118

      // Whale never crosses their own 2x (200) threshold under the capped
      // result — no win, no payout, exactly as the cap intended.
      expect(await env.crash.pendingPayout(env.p1.address)).to.equal(0n);

      // Small player is paid their FULL quoted amount (10 * 1.50 = 15) —
      // no fill-ratio scaling applied, because the pre-hoc cap already
      // guaranteed the round could afford everyone who's actually eligible
      // to win under it.
      expect(await env.crash.pendingPayout(env.p2.address)).to.equal(usdc(15));

      const before = await env.usdc_.balanceOf(env.p2.address);
      await env.crash.connect(env.p2).claim();
      const after = await env.usdc_.balanceOf(env.p2.address);
      expect(after - before).to.equal(usdc(15));
    });
  });
});
