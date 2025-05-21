import { randomBytes } from "@noble/ciphers/webcrypto";
import { readFromContract, writeToContract } from "./viemHelpers";
import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { split } from 'shamir-secret-sharing';
import { x25519 } from "@noble/curves/ed25519";
import { toHex } from "viem";

const dummyData = "Hello, World!";


export async function uploadRecord(patientAddress: `0x${string}`) {
    // Request public keys
    const physicanPublicKey = (await readFromContract<any>({functionName: 'addressToAgent', args: ['0x07754fF521386988000Ea6600410764E167B6D12']}))[2].split("0x")[1];
    const patientPublicKey = (await readFromContract<any>({functionName: 'addressToAgent', args: [patientAddress]}))[2].split("0x")[1];
    const hospitalPublicKey = (await readFromContract<any>({functionName: 'addressToAgent', args: ['0x8919Ed732B18b6b9d6297817E2984EEc79087a27']}))[2].split("0x")[1];
    const oracle1PublicKey = (await readFromContract<any>({functionName: 'getOracle', args: [0]})).publicKey.split("0x")[1];
    const oracle2PublicKey = (await readFromContract<any>({functionName: 'getOracle', args: [1]})).publicKey.split("0x")[1];

    const agents = [
        {role: 0, publicKey: hospitalPublicKey},
        {role: 2, publicKey: physicanPublicKey},
        {role: 1, publicKey: patientPublicKey},
        {role: 3, publicKey: oracle1PublicKey},
        {role: 3, publicKey: oracle2PublicKey},
    ];

    const fileKey = randomBytes(32);
    const fileNonce = randomBytes(12);

    const fileCipher = chacha20poly1305(fileKey, fileNonce);
    const dummyDataInBytes = new TextEncoder().encode(dummyData);
    const encryptedContent = fileCipher.encrypt(dummyDataInBytes);

    const authTag = encryptedContent.slice(-16);
    const ciphertext = encryptedContent.slice(0, -16);

    // const shares = await split(fileKey, 5, 3);
    const shares = (await split(fileKey, 5, 3)).map(share => share.slice(1));

    const encryptedShares = await Promise.all(
        agents.map(async (agent, index) => {
            const ephemeralPrivateKey = x25519.utils.randomPrivateKey();
            const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);

            const sharedSecret = x25519
                .getSharedSecret(ephemeralPrivateKey, agent.publicKey)
                .slice(0, 32);

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

    const txHash = await writeToContract({functionName: 'addRecord', args: [patientAddress, record]})
    console.log(txHash);

}
