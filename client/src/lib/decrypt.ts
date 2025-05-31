import { connectWallet, readFromContract } from "./viemHelpers";
import { combine } from "shamir-secret-sharing";
import { x25519 } from "@noble/curves/ed25519";
import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { fromHex } from "viem";

const patientAddress: `0x${string}` = "0xYourPatientAddressHere";
const recordIndex = 0;

export async function decryptRecord() {
  const { account: userAddress } = await connectWallet();

  const record = await readFromContract<any>({
    functionName: "getRecord",
    args: [patientAddress, recordIndex],
  });

  const [cid, encryptedShares, fileNonceHex, authTagHex] = record;

  const userPrivateKey = getPrivateKey();
  const decryptedShares: Uint8Array[] = [];

  for (const share of encryptedShares) {
    const [role, shareCiphertextHex, ephemeralPubHex, shareNonceHex, shareAuthTagHex] = share;

    const ephemeralPublicKey = fromHex(ensureHex(ephemeralPubHex), 'bytes');
    const shareNonce = fromHex(ensureHex(shareNonceHex), 'bytes');
    const shareCiphertext = fromHex(ensureHex(shareCiphertextHex), 'bytes');
    const shareAuthTag = fromHex(ensureHex(shareAuthTagHex), 'bytes');

    const encrypted = new Uint8Array([...shareCiphertext, ...shareAuthTag]);

    try {
      const sharedSecret = x25519
        .getSharedSecret(userPrivateKey, ephemeralPublicKey)
        .slice(0, 32);

      const shareCipher = chacha20poly1305(sharedSecret, shareNonce);
      const decryptedShare = shareCipher.decrypt(encrypted);

      decryptedShares.push(new Uint8Array([0, ...decryptedShare]));

      if (decryptedShares.length === 3) break;
    } catch (err) {
      console.warn(" Decryption failed for a share:", err);
    }
  }

  if (decryptedShares.length < 3) {
    throw new Error(" Not enough valid shares to reconstruct file key");
  }

  const fileKey = combine(decryptedShares);

  const encryptedFile = await fetchFromIPFS(cid);

  const fileNonce = fromHex(ensureHex(fileNonceHex), 'bytes');
  const authTag = fromHex(ensureHex(authTagHex), 'bytes');

  const fileCipher = chacha20poly1305(fileKey, fileNonce);
  const decrypted = fileCipher.decrypt(new Uint8Array([...encryptedFile, ...authTag]));

  const plainText = new TextDecoder().decode(decrypted);
  console.log("Decrypted Record:", plainText);
}

function ensureHex(hex: string): `0x${string}` {
  return hex.startsWith("0x") ? (hex as `0x${string}`) : `0x${hex}` as `0x${string}`;
}

function getPrivateKey(): Uint8Array {
  throw new Error(" Replace with real private key for testing");
}

async function fetchFromIPFS(cid: string): Promise<Uint8Array> {
  const url = `https://ipfs.io/ipfs/${cid}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(" IPFS fetch failed");
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

// Uncomment if testing from CLI
// decryptRecord().catch(console.error);
