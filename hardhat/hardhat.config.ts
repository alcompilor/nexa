import * as dotenv from "dotenv";
dotenv.config();

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.29",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        fuji: {
            url: "https://api.avax-test.network/ext/bc/C/rpc",
            chainId: 43113,
            accounts: process.env.HOSPITAL_ACCOUNT_PRIVATE_KEY
                ? [`0x${process.env.HOSPITAL_ACCOUNT_PRIVATE_KEY}`]
                : [],
        },
    },
    etherscan: {
        apiKey: {
            avalancheFujiTestnet: "no-api-needed",
        },
    },
};

export default config;
