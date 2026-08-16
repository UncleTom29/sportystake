import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";

dotenv.config();

const ARC_RPC_URL = process.env.ARC_RPC_URL || "https://rpc.arc.network";
const ARC_CHAIN_ID = parseInt(process.env.ARC_CHAIN_ID || "0", 10);
const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const accounts =
  OPERATOR_PRIVATE_KEY.length > 0 ? [OPERATOR_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: false,
      // Cancun required by @openzeppelin/contracts ^5.6's Bytes.sol (MCOPY).
      // Confirmed Arc Testnet's EVM supports MCOPY via a direct eth_call probe
      // before enabling this — verify the same on any other target network.
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: false,
    },
    arcTestnet: {
      url: ARC_RPC_URL,
      chainId: ARC_CHAIN_ID || 5042002,
      accounts,
      live: true,
      saveDeployments: true,
    },
    arcMainnet: {
      url: ARC_RPC_URL,
      chainId: ARC_CHAIN_ID || 5042,
      accounts,
      live: true,
      saveDeployments: true,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    operator: {
      default: 0,
    },
    treasury: {
      default: 1,
    },
  },
  typechain: {
    outDir: "./typechain-types",
    target: "ethers-v6",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    excludeContracts: ["mocks/"],
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./deploy",
    deployments: "./deployments",
  },
  mocha: {
    timeout: 120000,
  },
};

export default config;
