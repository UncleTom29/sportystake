/**
 * hardhat-deploy script for SportyStake.
 *
 * Local (`hardhat`):
 *   - Deploys a MockUSDC.
 *   - Deploys LiquidityPool → BettingCore → CasinoHouse → CrashGame, each
 *     behind a UUPS proxy via `@openzeppelin/hardhat-upgrades`.
 *   - Mints test USDC into the deployer wallet.
 *
 * Arc (testnet/mainnet):
 *   - Expects USDC_ADDRESS + TREASURY_ADDRESS in env.
 *   - Skips the mock + minting.
 *
 * Side-effects:
 *   - Registers each proxy with hardhat-deploy via `deployments.save(...)` so
 *     the SDK/Next.js app's `deployments/<network>/addresses.json` consumer
 *     keeps working unchanged.
 */
import { ethers, upgrades, deployments, getNamedAccounts, network } from "hardhat";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Contract } from "ethers";

/** Deploy `name` behind a UUPS proxy and register it with hardhat-deploy. */
async function deployProxy(
  name: string,
  constructorArgs: unknown[],
  initArgs: unknown[]
): Promise<Contract> {
  const factory = await ethers.getContractFactory(name);
  const proxy = await upgrades.deployProxy(factory, initArgs, {
    kind: "uups",
    constructorArgs,
  });
  await proxy.waitForDeployment();
  const address = await proxy.getAddress();

  await deployments.save(name, {
    abi: JSON.parse(factory.interface.formatJson()),
    address,
  });

  console.log(`${name} (proxy): ${address}`);
  return proxy as unknown as Contract;
}

async function main() {
  const { deployer, treasury } = await getNamedAccounts();

  const isLocal = network.name === "hardhat" || network.name === "localhost";

  let usdcAddress = process.env.USDC_ADDRESS || "";
  const treasuryAddress = process.env.TREASURY_ADDRESS || treasury || deployer;

  // 1. USDC
  if (isLocal || !usdcAddress) {
    const mock = await deployments.deploy("MockUSDC", { from: deployer, args: [], log: true });
    usdcAddress = mock.address;
  }
  console.log(`USDC at ${usdcAddress}`);

  // 2. LiquidityPool — the single, shared pool backing every market.
  const liquidityPool = await deployProxy(
    "LiquidityPool",
    [usdcAddress],
    [deployer]
  );
  const liquidityPoolAddress = await liquidityPool.getAddress();

  // 3. BettingCore
  const bettingCore = await deployProxy(
    "BettingCore",
    [usdcAddress],
    [liquidityPoolAddress, treasuryAddress, deployer]
  );
  const bettingCoreAddress = await bettingCore.getAddress();

  // Point the pool at BettingCore so it can lock/unlock/report.
  const pool = await ethers.getContractAt("LiquidityPool", liquidityPoolAddress);
  if ((await pool.bettingCore()) !== bettingCoreAddress) {
    const tx = await pool.setBettingCore(bettingCoreAddress);
    await tx.wait();
    console.log(`LiquidityPool.setBettingCore(${bettingCoreAddress})`);
  }

  // 4. CasinoHouse
  const casino = await deployProxy("CasinoHouse", [usdcAddress], [deployer]);
  const casinoAddress = await casino.getAddress();

  // 5. CrashGame
  const crash = await deployProxy("CrashGame", [usdcAddress], [deployer]);
  const crashAddress = await crash.getAddress();

  // 6. Mint test USDC locally
  if (isLocal) {
    const mintTo = deployer;
    const usdc = await ethers.getContractAt("MockUSDC", usdcAddress);
    const tx = await usdc.mint(mintTo, 1_000_000n * 10n ** 6n);
    await tx.wait();
    console.log(`minted 1,000,000 test USDC to ${mintTo}`);
  }

  // 7. Export addresses for the SDK + frontend
  const out = {
    chainId: Number(network.config.chainId ?? 31337),
    network: network.name,
    addresses: {
      usdc: usdcAddress,
      liquidityPool: liquidityPoolAddress,
      bettingCore: bettingCoreAddress,
      casinoHouse: casinoAddress,
      crashGame: crashAddress,
    },
  };
  const dir = join(__dirname, "..", "deployments", network.name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "addresses.json"), JSON.stringify(out, null, 2));
  console.log(`wrote ${join(dir, "addresses.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export default main;
main.tags = ["all"];
