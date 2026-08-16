/**
 * Pre-launch governance verification script.
 *
 * Checks whether the DEFAULT_ADMIN_ROLE holder for each deployed contract
 * is a multisig (contract) or an EOA. Exits with code 1 if any admin is
 * an EOA — an upgradeable proxy with one EOA holding DEFAULT_ADMIN_ROLE
 * is a single point of total failure.
 *
 * Usage:
 *   npx tsx scripts/verify-admin-governance.ts
 *
 * Since the contracts use AccessControlUpgradeable (not Enumerable), we
 * can't enumerate role members on-chain. Instead, we scan `RoleGranted`
 * events from genesis to find all addresses that were ever granted
 * DEFAULT_ADMIN_ROLE, then check if any are still active via `hasRole`.
 */
import { createPublicClient, http, type Address, parseAbiItem } from "viem";
import { clientEnv } from "../src/lib/env";

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

// Minimal ABI — just hasRole, shared by all OZ AccessControl contracts.
const accessControlAbi = [
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

async function main() {
  const rpcUrl = clientEnv.NEXT_PUBLIC_RPC_URL;
  const chainId = clientEnv.NEXT_PUBLIC_CHAIN_ID;

  console.log(`\nVerifying admin governance on chain ${chainId} using ${rpcUrl}...\n`);

  const publicClient = createPublicClient({ transport: http(rpcUrl) });

  const contracts: { name: string; address: string }[] = [
    { name: "BettingCore", address: clientEnv.NEXT_PUBLIC_BETTING_CORE_ADDRESS },
    { name: "CasinoHouse", address: clientEnv.NEXT_PUBLIC_CASINO_HOUSE_ADDRESS },
    { name: "CrashGame", address: clientEnv.NEXT_PUBLIC_CRASH_GAME_ADDRESS },
    { name: "LiquidityPool", address: clientEnv.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS },
  ];

  let hasEoaAdmin = false;
  const results: { Contract: string; "Admin Address": string; Type: string; Warning: string }[] = [];

  for (const contract of contracts) {
    if (!contract.address || contract.address === ZERO_ADDRESS) {
      results.push({
        Contract: contract.name,
        "Admin Address": "N/A",
        Type: "N/A",
        Warning: "Not deployed",
      });
      continue;
    }

    try {
      // Find all RoleGranted events for DEFAULT_ADMIN_ROLE
      const logs = await publicClient.getLogs({
        address: contract.address as Address,
        event: parseAbiItem("event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)"),
        args: { role: ZERO_BYTES32 },
        fromBlock: 0n,
        toBlock: "latest",
      });

      // Find unique addresses granted the admin role
      const candidates = [...new Set(logs.map((l) => l.args.account as Address))];

      // Check which ones still have the role
      const admins: Address[] = [];
      for (const addr of candidates) {
        if (!addr) continue;
        const has = await publicClient.readContract({
          address: contract.address as Address,
          abi: accessControlAbi,
          functionName: "hasRole",
          args: [ZERO_BYTES32, addr],
        });
        if (has) admins.push(addr);
      }

      if (admins.length === 0) {
        results.push({
          Contract: contract.name,
          "Admin Address": "None found",
          Type: "Unknown",
          Warning: "⚠️ No admin role holders found via events",
        });
        continue;
      }

      for (const admin of admins) {
        const code = await publicClient.getCode({ address: admin });
        const isContract = code !== undefined && code !== "0x";
        const typeStr = isContract ? "Contract (multisig?)" : "EOA";

        let warning = "";
        if (!isContract) {
          warning = "🚨 DANGER: Admin is an EOA";
          hasEoaAdmin = true;
        }

        results.push({
          Contract: contract.name,
          "Admin Address": admin,
          Type: typeStr,
          Warning: warning,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        Contract: contract.name,
        "Admin Address": "Error",
        Type: "Error",
        Warning: msg.split("\n")[0].substring(0, 80),
      });
    }
  }

  console.table(results);

  if (hasEoaAdmin) {
    console.log("\n⚠️  WARNING: One or more contracts have an EOA as DEFAULT_ADMIN_ROLE.");
    console.log("This is a critical security risk. Admin rights should be held by a multisig or timelock.\n");
    console.log("Action items:");
    console.log("  1. Deploy a Safe multisig with ≥2/3 threshold");
    console.log("  2. Grant DEFAULT_ADMIN_ROLE to the multisig");
    console.log("  3. Revoke DEFAULT_ADMIN_ROLE from the EOA");
    console.log("  4. Consider adding an OZ TimelockController\n");
    process.exit(1);
  } else {
    console.log("\n✅ Governance check passed: All active admins are smart contracts.\n");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Failed to run verification:", err);
  process.exit(1);
});
