import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.29", // Match the version you're using in the contract
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
};

export default config;
