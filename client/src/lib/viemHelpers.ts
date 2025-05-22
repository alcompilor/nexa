// viemHelpers.ts

import { createPublicClient, createWalletClient, http, custom } from "viem";
import { avalancheFuji } from "viem/chains";
import NexaABI from "../../NexaEHR.json";

const contractABI = NexaABI.abi;
const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;

// ✅ Public client (read-only)
const publicClient = createPublicClient({
    chain: avalancheFuji,
    transport: http(import.meta.env.VITE_RPC_URL),
});

// ✅ Connect MetaMask Wallet
export async function connectWallet() {
    if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("MetaMask is not available");
    }

    const walletClient = createWalletClient({
        chain: avalancheFuji,
        transport: custom(window.ethereum),
    });

    const [account] = await walletClient.requestAddresses();

    return { walletClient, account };
}

// -------------------------------
// ✅ Read from Contract
// -------------------------------
export async function readFromContract<T = unknown>({
    functionName,
    args = [],
    address = contractAddress,
    abi = contractABI,
}: {
    address?: `0x${string}`;
    abi?: any;
    functionName: string;
    args?: any[];
}): Promise<T> {
    try {
        const data = await publicClient.readContract({
            address,
            abi,
            functionName,
            args,
        });

        return data as T;
    } catch (error) {
        console.error("❌ readFromContract error:", error);
        throw error;
    }
}

// -------------------------------
// ✅ Write to Contract
// -------------------------------
export async function writeToContract({
    functionName,
    args = [],
    address = contractAddress,
    abi = contractABI,
}: {
    address?: `0x${string}`;
    abi?: any;
    functionName: string;
    args?: any[];
}) {
    try {
        const { walletClient, account } = await connectWallet();

        const txHash = await walletClient.writeContract({
            address,
            abi,
            functionName,
            args,
            account,
        });

        const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
        });

        if (receipt.status !== "success") {
            throw new Error(
                `Transaction failed with status: ${receipt.status}`
            );
        }

        return txHash;
    } catch (error) {
        console.error("❌ writeToContract error:", error);
        throw error;
    }
}
