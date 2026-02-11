import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
if (PRIVATE_KEY && !/^(0x)?[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)) {
  throw new Error("DEPLOYER_PRIVATE_KEY must be a valid 32-byte hex string");
}
const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const BASE_MAINNET_RPC = process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";

// Optional: Ethereum testnet (e.g., Hoodi) support.
// We intentionally keep this env-driven so we don't hardcode chain ids/RPCs.
const HOODI_RPC_URL = process.env.HOODI_RPC_URL;
const HOODI_CHAIN_ID = process.env.HOODI_CHAIN_ID ? Number(process.env.HOODI_CHAIN_ID) : undefined;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const HOODI_ETHERSCAN_API_URL = process.env.HOODI_ETHERSCAN_API_URL;
const HOODI_EXPLORER_URL = process.env.HOODI_EXPLORER_URL;

const networks: HardhatUserConfig["networks"] = {
  hardhat: {
    chainId: 31337,
  },
  localhost: {
    url: "http://127.0.0.1:8545",
    chainId: 31337,
  },
  "base-sepolia": {
    url: BASE_SEPOLIA_RPC,
    chainId: 84532,
    accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    gasPrice: "auto",
  },
  "base-mainnet": {
    url: BASE_MAINNET_RPC,
    chainId: 8453,
    accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    gasPrice: "auto",
  },
};

if (HOODI_RPC_URL && HOODI_CHAIN_ID) {
  networks["eth-hoodi"] = {
    url: HOODI_RPC_URL,
    chainId: HOODI_CHAIN_ID,
    accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    gasPrice: "auto",
  };
}

const customChains: NonNullable<HardhatUserConfig["etherscan"]>["customChains"] = [
  {
    network: "base-sepolia",
    chainId: 84532,
    urls: {
      apiURL: "https://api-sepolia.basescan.org/api",
      browserURL: "https://sepolia.basescan.org",
    },
  },
  {
    network: "base-mainnet",
    chainId: 8453,
    urls: {
      apiURL: "https://api.basescan.org/api",
      browserURL: "https://basescan.org",
    },
  },
];

// Only register a custom explorer if the user provides the URLs.
if (HOODI_CHAIN_ID && HOODI_ETHERSCAN_API_URL && HOODI_EXPLORER_URL) {
  customChains.push({
    network: "eth-hoodi",
    chainId: HOODI_CHAIN_ID,
    urls: {
      apiURL: HOODI_ETHERSCAN_API_URL,
      browserURL: HOODI_EXPLORER_URL,
    },
  });
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks,
  etherscan: {
    apiKey: {
      "base-sepolia": BASESCAN_API_KEY,
      "base-mainnet": BASESCAN_API_KEY,
      ...(HOODI_RPC_URL && HOODI_CHAIN_ID ? { "eth-hoodi": ETHERSCAN_API_KEY } : {}),
    },
    customChains,
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
