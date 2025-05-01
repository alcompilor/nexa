// client/global.d.ts
import { createWalletClient, custom } from 'viem';
import { avalancheFuji } from 'viem/chains';



export const useWallet = () => {
  const connectWallet = async () => {
    if (!window.ethereum) throw new Error('MetaMask not installed');
    const client = createWalletClient({
      chain: avalancheFuji,
      transport: custom(window.ethereum),
    });
    await client.requestAddresses(); // prompts MetaMask
    return client;
  };

  return { connectWallet };
};
