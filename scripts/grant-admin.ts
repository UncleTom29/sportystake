/**
 * Grant Admin or Operator roles to a SportyStake user wallet address or username.
 *
 * Usage:
 *   npx tsx scripts/grant-admin.ts <walletAddressOrUsername> [ADMIN|OPERATOR|USER]
 *
 * Example:
 *   npx tsx scripts/grant-admin.ts 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 ADMIN
 */

import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const target = process.argv[2];
  const roleInput = (process.argv[3] || "ADMIN").toUpperCase() as Role;

  if (!target) {
    console.error("Usage: npx tsx scripts/grant-admin.ts <walletAddressOrUsername> [ADMIN|OPERATOR|USER]");
    process.exit(1);
  }

  if (!["USER", "OPERATOR", "ADMIN"].includes(roleInput)) {
    console.error("Invalid role. Expected one of: USER, OPERATOR, ADMIN");
    process.exit(1);
  }

  // Find user by wallet address (case-insensitive) or username
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { walletAddress: { equals: target, mode: "insensitive" } },
        { username: { equals: target, mode: "insensitive" } },
        { id: target },
      ],
    },
  });

  if (!user) {
    console.error(`User not found for target "${target}". Please sign in on the app first so your user profile is created.`);
    process.exit(1);
  }

  const currentRoles = new Set<Role>(user.roles);
  if (roleInput === "ADMIN") {
    currentRoles.add(Role.ADMIN);
    currentRoles.add(Role.OPERATOR);
  } else if (roleInput === "OPERATOR") {
    currentRoles.add(Role.OPERATOR);
  } else {
    currentRoles.clear();
    currentRoles.add(Role.USER);
  }

  const updatedRoles = Array.from(currentRoles);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { roles: updatedRoles },
  });

  console.log(`\n✅ Success! User updated:`);
  console.log(`   ID:             ${updated.id}`);
  console.log(`   Wallet Address: ${updated.walletAddress}`);
  console.log(`   Username:       ${updated.username ?? "—"}`);
  console.log(`   Updated Roles:  ${updated.roles.join(", ")}\n`);
}

main()
  .catch((e) => {
    console.error("Error updating user roles:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
