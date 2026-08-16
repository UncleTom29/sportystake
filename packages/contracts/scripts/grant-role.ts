/**
 * Grant (or revoke) an AccessControl role on any of the deployed contracts.
 *
 * Usage:
 *   CONTRACT=CrashGame ROLE=OPERATOR_ROLE ADDRESS=0x... \
 *     npx hardhat run scripts/grant-role.ts --network arcTestnet
 *
 * CONTRACT: BettingCore | CasinoHouse | CrashGame | LiquidityPool
 * ROLE:     ADMIN_ROLE | OPERATOR_ROLE | PAUSER_ROLE | ORACLE_SIGNER_ROLE (BettingCore only) | DEFAULT_ADMIN_ROLE
 *           (any role the contract actually exposes as a `<ROLE>()` getter works —
 *           this script doesn't hardcode the list, it just calls that getter)
 * ADDRESS:  the address to grant/revoke the role for
 *
 * Optional:
 *   ACTION=revoke              defaults to "grant"
 *   PROXY_ADDRESS=0x...        overrides the address auto-resolved from
 *                              deployments/<network>/addresses.json
 *
 * The signer (from hardhat.config.ts's `accounts`, i.e. OPERATOR_PRIVATE_KEY
 * in this package's own .env) must already hold that role's admin role —
 * DEFAULT_ADMIN_ROLE for every role in this codebase, none of these
 * contracts reassign role-admin. Reports hasRole before and after so the
 * result is verified, not just assumed from a successful tx.
 */
import { ethers, network } from "hardhat";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CONTRACT_KEY: Record<string, string> = {
  BettingCore: "bettingCore",
  CasinoHouse: "casinoHouse",
  CrashGame: "crashGame",
  LiquidityPool: "liquidityPool",
};

function resolveProxyAddress(contractName: string): string {
  if (process.env.PROXY_ADDRESS) return process.env.PROXY_ADDRESS;

  const key = CONTRACT_KEY[contractName];
  if (!key) throw new Error(`Unknown CONTRACT "${contractName}" — expected one of ${Object.keys(CONTRACT_KEY).join(", ")}`);

  const path = join(__dirname, "..", "deployments", network.name, "addresses.json");
  const addresses = JSON.parse(readFileSync(path, "utf8")).addresses;
  const address = addresses[key];
  if (!address) throw new Error(`No ${key} address in ${path} — set PROXY_ADDRESS explicitly`);
  return address;
}

async function main() {
  const contractName = process.env.CONTRACT;
  const roleName = process.env.ROLE;
  const targetAddress = process.env.ADDRESS;
  const action = process.env.ACTION === "revoke" ? "revoke" : "grant";

  if (!contractName || !roleName || !targetAddress) {
    throw new Error("Set CONTRACT, ROLE, and ADDRESS env vars before running this script.");
  }

  const proxyAddress = resolveProxyAddress(contractName);
  const contract = await ethers.getContractAt(contractName, proxyAddress);

  const role = await contract.getFunction(roleName)();
  console.log(`${roleName} on ${contractName} (${proxyAddress}) = ${role}`);

  const before: boolean = await contract.hasRole(role, targetAddress);
  console.log(`${targetAddress} currently has it: ${before}`);

  if (action === "grant" && before) {
    console.log("Already granted — nothing to do.");
    return;
  }
  if (action === "revoke" && !before) {
    console.log("Already doesn't have it — nothing to do.");
    return;
  }

  console.log(`${action === "grant" ? "Granting" : "Revoking"}...`);
  const tx = await contract[action === "grant" ? "grantRole" : "revokeRole"](role, targetAddress);
  await tx.wait();

  const after: boolean = await contract.hasRole(role, targetAddress);
  console.log(`Done. ${targetAddress} now has ${roleName}: ${after}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
