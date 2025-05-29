import { randomBytes } from "@noble/ciphers/webcrypto";
import {
  connectWallet,
  readFromContract,
  writeToContract,
} from "./viemHelpers";
import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { split } from "shamir-secret-sharing";
import { x25519 } from "@noble/curves/ed25519";
import { toHex, hexToBytes } from "viem";
import { sha256 } from "@noble/hashes/sha2";

// Strongly typed
type Agent = {
  role: number;
  publicKey: `0x${string}`;
};

const dummyData = "Hello, World!";

export async function uploadRecord(patientAddress: `0x${string}`) {
  const { account: physicianAccount } = await connectWallet();

  // Read and normalize agent public keys to always have '0x' prefix
  const rawAgents = await readFromContract<Array<{ role: number; publicKey: string }>>({
    functionName: "getAgents",
    args: [patientAddress, physicianAccount],
  });

  const agents: Agent[] = rawAgents.map(agent => ({
    role: agent.role,
    publicKey: agent.publicKey.startsWith("0x")
      ? agent.publicKey as `0x${string}`
      : (`0x${agent.publicKey}` as `0x${string}`),
  }));

  // Encrypt file
  const fileKey = randomBytes(32);
  const fileNonce = randomBytes(12);
  const fileCipher = chacha20poly1305(fileKey, fileNonce);
  const dummyDataInBytes = new TextEncoder().encode(dummyData);
  const encryptedContent = fileCipher.encrypt(dummyDataInBytes);
  const authTag = encryptedContent.slice(-16);
  const ciphertext = encryptedContent.slice(0, -16);

  // Split file key into shares
  const shares = await split(fileKey, 5, 3);

  const encryptedShares = await Promise.all(
    agents.map(async (agent, index) => {
      const ephemeralPrivateKey = x25519.utils.randomPrivateKey();
      const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);

      // Use viem's hexToBytes safely now
      const agentPublicKeyBytes = hexToBytes(agent.publicKey);
      const sharedSecret = x25519
        .getSharedSecret(ephemeralPrivateKey, agentPublicKeyBytes)
        .slice(0, 32);

      const shareNonce = randomBytes(12);
      const shareCipher = chacha20poly1305(sharedSecret, shareNonce);

      // Ensure 32-byte encrypted key share using hash
      const hashedShare = sha256(shares[index]);
      const encryptedShare = shareCipher.encrypt(hashedShare);
      const shareAuthTag = encryptedShare.slice(-16);
      const shareCiphertext = encryptedShare.slice(0, -16);

      if (shareCiphertext.length !== 32) {
        throw new Error("Encrypted share must be exactly 32 bytes.");
      }

      return [
        agent.role,
        toHex(shareCiphertext),
        toHex(ephemeralPublicKey),
        toHex(shareNonce),
        toHex(shareAuthTag),
      ];
    })
  );

  // still need to implement IPFS logic later here


  const placeholderCid = toHex(randomBytes(64)); // temporary CID placeholder

  const record = [
    placeholderCid,       // bytes contentId
    encryptedShares,      // EncryptedShare[5]
    toHex(fileNonce),     // bytes12
    toHex(authTag),       // bytes16
  ];

  const txHash = await writeToContract({
    functionName: "addRecord",
    args: [patientAddress, record],
  });

  console.log("✅ Record uploaded with tx:", txHash);
}
