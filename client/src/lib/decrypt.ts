/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    connectWallet,
    readFromContract,
    watchKeyResponseEvent,
    writeToContract,
} from "./viemHelpers";
import { combine } from "shamir-secret-sharing";
import { x25519 } from "@noble/curves/ed25519";
import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { concat, fromHex, toHex } from "viem";
import { usePatientPrivKeyStore } from "../stores/usePatientPrivKeyStore";
import { ipfsRetrieve } from "./ipfsClient";

export async function fetchRecord(recordIndex?: number) {
    const patientPrivKey = usePatientPrivKeyStore.getState().privKey;
    const requestId = generateRandomId() as `0x{string}`;
    const { account: patientAddress } = await connectWallet();

    const record = recordIndex
        ? await readFromContract<any>({
              functionName: "getRecord",
              args: [patientAddress, recordIndex],
          })
        : await readFromContract<any>({
              functionName: "getLatestRecord",
              args: [patientAddress],
          });

    await writeToContract({
        functionName: "requestOracleAssistance",
        args: [requestId, record],
    });

    const encryptedShares = await watchKeyResponseEvent(requestId);
    encryptedShares.push(
        record.encryptedKeyShares.find((share: any) => share.role === 1)
    );

    const rawKeyShares = encryptedShares.map((share: any) => {
        const authTagBytes = fromHex(share.authTag, "bytes");
        const encryptedKeyShareBytes = fromHex(
            share.encryptedKeyShare,
            "bytes"
        );

        const nonceBytes = fromHex(share.nonce, "bytes");
        const ephemeralPublicKeyHex = share.ephemeralPublicKey.slice(2);

        const sharedSecret = x25519
            .getSharedSecret(patientPrivKey!, ephemeralPublicKeyHex)
            .slice(0, 32);

        const ciphertextWithTag = concat([
            encryptedKeyShareBytes,
            authTagBytes,
        ]);

        const cipher = chacha20poly1305(sharedSecret, nonceBytes);
        const decryptedShare = cipher.decrypt(ciphertextWithTag);

        return decryptedShare;
    });

    const fileKey = await combine(rawKeyShares);
    const fileDataInBytes = await ipfsRetrieve(
        fromHex(record.contentId, "string")
    );

    const fileAuthTagBytes = fromHex(record.authTag, "bytes");
    const fileNonceBytes = fromHex(record.nonce, "bytes");

    const ciphertextWithTag = concat([fileDataInBytes!, fileAuthTagBytes]);

    const fileCipher = chacha20poly1305(fileKey, fileNonceBytes);
    const decryptedDataInBytes = fileCipher.decrypt(ciphertextWithTag);

    const decryptedData = new TextDecoder().decode(decryptedDataInBytes);
    return decryptedData;
}

function generateRandomId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return toHex(bytes);
}
