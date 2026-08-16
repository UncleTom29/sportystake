/**
 * Direct deployment script — uses ethers.js + @openzeppelin/hardhat-upgrades
 * directly (no hardhat-deploy). Run:
 *   npx hardhat run scripts/deploy-direct.ts --network arcTestnet
 */
import { ethers, upgrades, network } from "hardhat";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatUnits(await ethers.provider.getBalance(deployer.address), 18));
  console.log("Network:", network.name, "chainId:", network.config.chainId);

  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;
  let usdcAddress = process.env.USDC_ADDRESS || "";

  // 1. MockUSDC (always on testnet if no USDC_ADDRESS given)
  if (!usdcAddress) {
    console.log("\nDeploying MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    console.log("MockUSDC:", usdcAddress);
  } else {
    console.log("Using existing USDC:", usdcAddress);
  }

  // 2. LiquidityPool (UUPS proxy) — the single, shared pool.
  console.log("\nDeploying LiquidityPool...");
  const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
  const pool = await upgrades.deployProxy(LiquidityPool, [deployer.address], {
    kind: "uups",
    constructorArgs: [usdcAddress],
  });
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log("LiquidityPool:", poolAddress);

  // 3. BettingCore (UUPS proxy)
  console.log("\nDeploying BettingCore...");
  const BettingCore = await ethers.getContractFactory("BettingCore");
  const core = await upgrades.deployProxy(
    BettingCore,
    [poolAddress, treasuryAddress, deployer.address],
    { kind: "uups", constructorArgs: [usdcAddress] }
  );
  await core.waitForDeployment();
  const coreAddress = await core.getAddress();
  console.log("BettingCore:", coreAddress);

  // Point the pool at BettingCore so it can lock/unlock/report.
  const setCoreTx = await (pool as any).setBettingCore(coreAddress);
  await setCoreTx.wait();
  console.log("LiquidityPool.setBettingCore ->", coreAddress);

  // 4. CasinoHouse (UUPS proxy)
  console.log("\nDeploying CasinoHouse...");
  const CasinoHouse = await ethers.getContractFactory("CasinoHouse");
  const casino = await upgrades.deployProxy(CasinoHouse, [deployer.address], {
    kind: "uups",
    constructorArgs: [usdcAddress],
  });
  await casino.waitForDeployment();
  const casinoAddress = await casino.getAddress();
  console.log("CasinoHouse:", casinoAddress);

  // 5. CrashGame (UUPS proxy)
  console.log("\nDeploying CrashGame...");
  const CrashGame = await ethers.getContractFactory("CrashGame");
  const crash = await upgrades.deployProxy(CrashGame, [deployer.address], {
    kind: "uups",
    constructorArgs: [usdcAddress],
  });
  await crash.waitForDeployment();
  const crashAddress = await crash.getAddress();
  console.log("CrashGame:", crashAddress);

  // Save addresses
  const out = {
    chainId: Number(network.config.chainId ?? 31337),
    network: network.name,
    deployedAt: new Date().toISOString(),
    addresses: {
      usdc: usdcAddress,
      liquidityPool: poolAddress,
      bettingCore: coreAddress,
      casinoHouse: casinoAddress,
      crashGame: crashAddress,
    },
  };

  const dir = join(__dirname, "..", "deployments", network.name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "addresses.json"), JSON.stringify(out, null, 2));
  console.log(`\nAddresses saved to deployments/${network.name}/addresses.json`);
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
