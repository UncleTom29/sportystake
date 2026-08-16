/**
 * Second step of the BettingCore V2 (EIP-712 market attestations) rollout —
 * run this immediately after `upgrade.ts` has pointed the proxy at the new
 * implementation. Calls `initializeV2`, which wires the EIP-712 domain
 * separator and grants the first ORACLE_SIGNER_ROLE holder.
 *
 * Usage:
 *   PROXY_ADDRESS=0x... ORACLE_SIGNER_ADDRESS=0x... \
 *     npx hardhat run scripts/initialize-v2.ts --network arcTestnet
 *
 * ORACLE_SIGNER_ADDRESS is the public address matching whatever private key
 * your backend will use to sign MarketAttestation tickets — NOT the deployer
 * or an OPERATOR_ROLE key. Additional signers can be granted later via
 * grantRole(ORACLE_SIGNER_ROLE, ...) from a DEFAULT_ADMIN_ROLE account.
 */
import { ethers } from "hardhat";

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const oracleSignerAddress = process.env.ORACLE_SIGNER_ADDRESS;

  if (!proxyAddress || !oracleSignerAddress) {
    throw new Error("Set PROXY_ADDRESS and ORACLE_SIGNER_ADDRESS env vars before running this script.");
  }

  const core = await ethers.getContractAt("BettingCore", proxyAddress);

  console.log(`Calling initializeV2(${oracleSignerAddress}) on BettingCore @ ${proxyAddress}...`);
  const tx = await core.initializeV2(oracleSignerAddress);
  await tx.wait();

  const role = await core.ORACLE_SIGNER_ROLE();
  const granted = await core.hasRole(role, oracleSignerAddress);
  console.log(`Done. ORACLE_SIGNER_ROLE granted to ${oracleSignerAddress}: ${granted}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
