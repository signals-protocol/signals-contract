import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

// Get private key from environment variables (for deployment)
const PRIVATE_KEY =
  process.env.PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000000";

// Rootstock Testnet RPC URL
const ROOTSTOCK_TESTNET_URL = "https://public-node.testnet.rsk.co";

// Polygon Amoy Testnet RPC URL
const POLYGON_AMOY_URL =
  process.env.POLYGON_AMOY_URL || "https://rpc-amoy.polygon.technology";

// Citrea Testnet RPC URL
const CITREA_TESTNET_URL =
  process.env.CITREA_TESTNET_URL || "https://rpc.testnet.citrea.xyz";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
    },
    rskTestnet: {
      url: ROOTSTOCK_TESTNET_URL,
      accounts: [PRIVATE_KEY],
      chainId: 31,
      gasPrice: 60000000,
    },
    polygonAmoy: {
      url: POLYGON_AMOY_URL,
      accounts: [PRIVATE_KEY],
      chainId: 80002,
      gasPrice: "auto",
    },
    citreaTestnet: {
      url: CITREA_TESTNET_URL,
      accounts: [PRIVATE_KEY],
      chainId: 5115,
      gasPrice: "auto",
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
