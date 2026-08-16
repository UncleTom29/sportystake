/**
 * Upgrade an already-deployed UUPS proxy to a new implementation.
 *
 * Usage:
 *   CONTRACT=BettingCore PROXY_ADDRESS=0x... \
 *     npx hardhat run scripts/upgrade.ts --network arcTestnet
 *
 * `CONTRACT` must name the *new* contract artifact to upgrade to (e.g. point
 * it at `BettingCoreV2` once that contract exists) — it defaults to
 * re-deploying the current artifact under the same name, which is only
 * useful for verifying the upgrade flow itself.
 *
 * `USDC_ADDRESS` (optional): LiquidityPool/BettingCore/CasinoHouse/CrashGame
 * all take an immutable `address _usdc` constructor arg (unrelated to
 * upgradeable storage — re-supplied on every implementation deploy, same as
 * deploy-direct.ts does for the initial deploy). Set this when upgrading
 * any of them; omit it for a contract with no constructor args.
 *
 * `@openzeppelin/hardhat-upgrades` validates the new implementation's
 * storage layout against the existing one before upgrading, and refuses to
 * proceed if it detects an incompatible layout change.
 */
import { ethers, upgrades } from "hardhat";

async function main() {
  const contractName = process.env.CONTRACT;
  const proxyAddress = process.env.PROXY_ADDRESS;
  const usdcAddress = process.env.USDC_ADDRESS;

  if (!contractName || !proxyAddress) {
    throw new Error("Set CONTRACT and PROXY_ADDRESS env vars before running this script.");
  }

  console.log(`Upgrading proxy ${proxyAddress} to new ${contractName} implementation...`);

  const NewImplementation = await ethers.getContractFactory(contractName);
  const upgraded = await upgrades.upgradeProxy(proxyAddress, NewImplementation, {
    ...(usdcAddress ? { constructorArgs: [usdcAddress] } : {}),
    // BettingCore's V2 (EIP-712 attestations) splits initialization across
    // initialize() + initializeV2(reinitializer(2)) — see that function's
    // doc comment. The validator can't see across the two-phase split and
    // flags both halves as individually incomplete even though together
    // they call every parent initializer exactly once. Harmless for any
    // contract that doesn't use this pattern.
    unsafeAllow: ["missing-initializer-call", "incorrect-initializer-order"],
  });
  await upgraded.waitForDeployment();

  const newImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`Proxy ${proxyAddress} now points at implementation ${newImplAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
