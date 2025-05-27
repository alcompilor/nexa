import { connectWallet, readFromContract } from "./viemHelpers";
import { combine } from "shamir-secret-sharing";
import { x25519 } from "@noble/curves/ed25519";
import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { fromHex } from "viem";

// --- Inputs ---
const patientAddress: `0x${string}` = "0xYourPatientAddressHere";
const recordIndex = 0; // or dynamically chosen

async function decryptRecord() {
  const { account } = await connectWallet();

  // Step 1: Fetch Record Metadata
  const record = await readFromContract<any>({
    functionName: "getRecord",
    args: [patientAddress, recordIndex],
  });

  const [cid, encryptedShares, fileNonceHex, authTagHex] = record;

  // Step 2: Fetch Re-Encrypted Shares from Event Logs or Separate Call
  const keyShareResponse = await readFromContract<any>({
    functionName: "getKeyShares",
    args: [patientAddress, recordIndex],
  });

  const decryptedShares: Uint8Array[] = [];

  for (const share of keyShareResponse) {
    const [ephemeralPubHex, shareNonceHex, shareCiphertextHex] = share;

    const ephemeralPublicKey = fromHex(ephemeralPubHex);
    const shareNonce = fromHex(shareNonceHex);
    const shareCiphertext = fromHex(shareCiphertextHex);

    // Assume user has their own privateKey securely stored or derived
    const userPrivateKey = getPrivateKey(); // implement this securely

    const sharedSecret = x25519
      .getSharedSecret(userPrivateKey, ephemeralPublicKey)
      .slice(0, 32);

    const shareCipher = chacha20poly1305(sharedSecret, shareNonce);
    const decryptedShare = shareCipher.decrypt(
      new Uint8Array([...shareCiphertext, ...new Uint8Array(16)]) // Add dummy authTag
    );

    decryptedShares.push(new Uint8Array([0, ...decryptedShare]));
    if (decryptedShares.length === 3) break; // Only need 3 shares
  }

  // Step 3: Reconstruct the File Key
  const fileKey = combine(decryptedShares);

  // Step 4: Fetch Encrypted File from IPFS (mocked here)
  const encryptedContent = await fetchFromIPFS(cid); // implement this

  // Step 5: Decrypt File Content
  const fileNonce = fromHex(fileNonceHex);
  const authTag = fromHex(authTagHex);

  const fileCipher = chacha20poly1305(fileKey, fileNonce);
  const decrypted = fileCipher.decrypt(new Uint8Array([...encryptedContent, ...authTag]));

  const plainText = new TextDecoder().decode(decrypted);
  console.log("Decrypted Record:", plainText);
}

decryptRecord().catch(console.error);

// Placeholder: Replace with actual private key retrieval
function getPrivateKey(): Uint8Array {
  throw new Error("Private key management is not implemented");
}

// Placeholder: Replace with actual IPFS gateway call
async function fetchFromIPFS(cid: string): Promise<Uint8Array> {
  console.log("Fetching file from IPFS with CID:", cid);
  return new TextEncoder().encode("Encrypted content from IPFS");
}
