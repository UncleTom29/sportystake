/**
 * Server-side store for Virtual Liquidity & Wagered Volume configurations.
 * Manages virtual boosts for:
 *   1. Sports Betting Liquidity Pool
 *   2. Casino House Bankroll Vault
 *   3. Total Protocol Wagered Volume
 *
 * Persisted in memory + file backup for reliable persistence.
 */

import fs from "fs";
import path from "path";
import { logger } from "@/lib/server/logger";

export interface VirtualLiquidityConfig {
  sportsPoolUsdc: number;
  casinoVaultUsdc: number;
  virtualWageredUsdc: number;
  updatedAt: string;
}

const CONFIG_FILE = path.join(process.cwd(), "data", "virtual-liquidity.json");

let cachedConfig: VirtualLiquidityConfig = {
  sportsPoolUsdc: 50000, // Default 50,000 USDC virtual liquidity boost
  casinoVaultUsdc: 25000, // Default 25,000 USDC virtual liquidity boost
  virtualWageredUsdc: 5000000, // Default 5,000,000 USDC virtual wagered volume boost
  updatedAt: new Date().toISOString(),
};

function loadFromFile(): VirtualLiquidityConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      const data = JSON.parse(raw) as VirtualLiquidityConfig;
      if (
        typeof data.sportsPoolUsdc === "number" &&
        typeof data.casinoVaultUsdc === "number"
      ) {
        cachedConfig = {
          sportsPoolUsdc: data.sportsPoolUsdc,
          casinoVaultUsdc: data.casinoVaultUsdc,
          virtualWageredUsdc: typeof data.virtualWageredUsdc === "number" ? data.virtualWageredUsdc : 5000000,
          updatedAt: data.updatedAt || new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    logger.warn("[virtualLiquidityStore] Failed to read config file", { error: (err as Error).message });
  }
  return cachedConfig;
}

function saveToFile(config: VirtualLiquidityConfig) {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    logger.error("[virtualLiquidityStore] Failed to save config file", { error: (err as Error).message });
  }
}

// Initialize on module load
loadFromFile();

export function getVirtualLiquidityConfig(): VirtualLiquidityConfig {
  return loadFromFile();
}

export function updateVirtualLiquidityConfig(input: {
  sportsPoolUsdc?: number;
  casinoVaultUsdc?: number;
  virtualWageredUsdc?: number;
}): VirtualLiquidityConfig {
  const current = getVirtualLiquidityConfig();
  const updated: VirtualLiquidityConfig = {
    sportsPoolUsdc: typeof input.sportsPoolUsdc === "number" ? Math.max(0, input.sportsPoolUsdc) : current.sportsPoolUsdc,
    casinoVaultUsdc: typeof input.casinoVaultUsdc === "number" ? Math.max(0, input.casinoVaultUsdc) : current.casinoVaultUsdc,
    virtualWageredUsdc: typeof input.virtualWageredUsdc === "number" ? Math.max(0, input.virtualWageredUsdc) : current.virtualWageredUsdc,
    updatedAt: new Date().toISOString(),
  };

  cachedConfig = updated;
  saveToFile(updated);
  logger.info("[virtualLiquidityStore] Updated virtual config", updated as unknown as Record<string, unknown>);
  return updated;
}
