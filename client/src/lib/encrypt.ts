import { randomBytes } from "@noble/ciphers/webcrypto";
import {
    connectWallet,
    readFromContract,
    writeToContract,
} from "./viemHelpers";
import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { split } from "shamir-secret-sharing";
import { x25519 } from "@noble/curves/ed25519";
import { toHex } from "viem";
import { hexToBytes } from "viem";


type Agent = {
    role: number;
    publicKey: string;
  };  

const dummyData = "Hello, World!";

export async function uploadRecord(patientAddress: `0x${string}`) {
    const { account: physicianAccount } = await connectWallet();

    // Request public keys
    const rawAgents = await readFromContract<Array<{ role: number; publicKey: string }>>({
        functionName: "getAgents",
        args: [patientAddress, physicianAccount],
    });
    
    const agents: Agent[] = rawAgents.map(agent => ({
        role: agent.role,
        publicKey: agent.publicKey.startsWith("0x") ? agent.publicKey.slice(2) : agent.publicKey,
    }));
    
    const fileKey = randomBytes(32);
    const fileNonce = randomBytes(12);

    const fileCipher = chacha20poly1305(fileKey, fileNonce);
    const dummyDataInBytes = new TextEncoder().encode(dummyData);
    const encryptedContent = fileCipher.encrypt(dummyDataInBytes);

    const authTag = encryptedContent.slice(-16);
    const ciphertext = encryptedContent.slice(0, -16);

    const shares = await split(fileKey, 5, 3);

    const encryptedShares = await Promise.all(
        agents.map(async (agent, index) => {
            const ephemeralPrivateKey = x25519.utils.randomPrivateKey();
            const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);

            /*
            const sharedSecret = x25519
                .getSharedSecret(ephemeralPrivateKey, agent.publicKey)
                .slice(0, 32);
                */
            
            const agentPublicKeyBytes = hexToBytes(`0x${agent.publicKey}`);
            const sharedSecret = x25519.getSharedSecret(ephemeralPrivateKey, agentPublicKeyBytes).slice(0, 32);
                

            const shareNonce = randomBytes(12);
            const shareCipher = chacha20poly1305(sharedSecret, shareNonce);
            const encryptedShare = shareCipher.encrypt(shares[index]);
            const shareAuthTag = encryptedShare.slice(-16);
            const shareCiphertext = encryptedShare.slice(0, -16);

            return [
                agent.role,
                toHex(shareCiphertext),
                toHex(ephemeralPublicKey),
                toHex(shareNonce),
                toHex(shareAuthTag),
            ];
        })
    );

    // IPFS storage logic here to store ciphertext;

    const record = [
        toHex(randomBytes(64)),
        encryptedShares,
        toHex(fileNonce),
        toHex(authTag),
    ];

    const txHash = await writeToContract({
        functionName: "addRecord",
        args: [patientAddress, record],
    });
    console.log(txHash);
}
