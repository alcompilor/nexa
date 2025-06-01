import express from "express";
import dotenv from "dotenv";
import {
    createPublicClient,
    createWalletClient,
    getContract,
    http,
} from "viem";
import { avalancheFuji } from "viem/chains";
import { x25519 } from "@noble/curves/ed25519";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { randomBytes } from "crypto";
import { hexToBytes } from "@noble/ciphers/utils";
import { privateKeyToAccount } from "viem/accounts";
import { bytesToHex } from "@noble/curves/abstract/utils";
import chalk from "chalk";
import fs from "fs";

// Set up file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load contract ABI
const contractAbiPath = path.join(__dirname, "../NexaEHR.json");
const NexaEHRJson = JSON.parse(readFileSync(contractAbiPath, "utf-8"));
const abi = NexaEHRJson.abi;

const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

let {
    ORACLE_PRIVATE_KEY,
    ORACLE_CHAIN_PRIVATE_KEY,
    CONTRACT_ADDRESS,
    RPC_URL,
} = process.env;

if (!ORACLE_CHAIN_PRIVATE_KEY || !CONTRACT_ADDRESS || !RPC_URL) {
    console.error(
        chalk.bgRed.white.bold(
            "❌ Missing required environment variables (ORACLE_CHAIN_PRIVATE_KEY, CONTRACT_ADDRESS, or RPC_URL). Please check your .env file."
        )
    );
    process.exit(1);
}

// Only generate ORACLE_PRIVATE_KEY if missing
if (!ORACLE_PRIVATE_KEY) {
    const newRandomPrivKey = x25519.utils.randomPrivateKey();
    const hexKey = Buffer.from(newRandomPrivKey).toString("hex");

    try {
        fs.appendFileSync(envPath, `\nORACLE_PRIVATE_KEY=${hexKey}`, "utf-8");
        console.log(
            chalk.bgGreen.white.bold(
                "✅ ORACLE_PRIVATE_KEY (X25519) generated and saved to .env"
            ) +
                chalk.bgRedBright.white.bold(
                    "\n⚠️  This key is X25519-based and is intended to be permanent." +
                        "\n   Please store it in a secure environment. Losing it will make data recovery impossible.\n"
                )
        );
        process.env.ORACLE_PRIVATE_KEY = hexKey;
        ORACLE_PRIVATE_KEY = hexKey;
    } catch (err) {
        console.error(
            chalk.red("❌ Failed to write ORACLE_PRIVATE_KEY to .env"),
            err
        );
        process.exit(1);
    }
}

const oracleCryptoPrivKey = ORACLE_PRIVATE_KEY;

const contractAddress = CONTRACT_ADDRESS as `0x${string}`;

// Initialize blockchain clients
const pubClient = createPublicClient({
    chain: avalancheFuji,
    transport: http(RPC_URL),
});

const account = privateKeyToAccount(`0x${ORACLE_CHAIN_PRIVATE_KEY}`);

const walletClient = createWalletClient({
    account,
    chain: avalancheFuji,
    transport: http(RPC_URL),
});

const writeContract = getContract({
    address: contractAddress,
    abi,
    client: {
        public: pubClient,
        wallet: walletClient,
    },
});

// Utility functions
const normalizeHexString = (hexString: any) => {
    return hexString.startsWith("0x")
        ? hexToBytes(hexString.slice(2))
        : hexToBytes(hexString);
};

const bytesToHexString = (bytes: any) => {
    return `0x${Buffer.from(bytes).toString("hex")}`;
};

/**
 * Decrypts an encrypted key share using the oracle's private key
 * @param {Object} share - The encrypted key share
 * @returns {Uint8Array} - The decrypted key share
 */
const decryptKeyShare = (share: any): Uint8Array => {
    const encryptedShareNonce = normalizeHexString(share.nonce);
    const encryptedShareAuthTag = normalizeHexString(share.authTag);
    const encryptedKeyShare = normalizeHexString(share.encryptedKeyShare);

    // Prepare ephemeral public key
    const ephemeralPubKeyHex = share.ephemeralPublicKey.startsWith("0x")
        ? share.ephemeralPublicKey.slice(2)
        : share.ephemeralPublicKey;

    const derivedSecret = x25519.getSharedSecret(
        oracleCryptoPrivKey,
        ephemeralPubKeyHex
    );

    const cipher = chacha20poly1305(derivedSecret, encryptedShareNonce);

    const combinedData = new Uint8Array(
        encryptedKeyShare.length + encryptedShareAuthTag.length
    );
    combinedData.set(encryptedKeyShare, 0);
    combinedData.set(encryptedShareAuthTag, encryptedKeyShare.length);

    return cipher.decrypt(combinedData);
};

/**
 * Re-encrypts a key share for the requester
 * @param {Uint8Array} decryptedKeyShare - The decrypted key share
 * @param {Uint8Array} requesterPubKey - The requester's public key
 * @returns {Object} - The re-encrypted key share data
 */
const reEncryptKeyShare = (
    decryptedKeyShare: any,
    requesterPubKey: any
): object => {
    const ephermalPrivKey = x25519.utils.randomPrivateKey();
    const ephermalPubKey = x25519.getPublicKey(ephermalPrivKey);

    const newSharedSecret = x25519.getSharedSecret(
        ephermalPrivKey,
        requesterPubKey
    );
    const newNonce = randomBytes(12);
    const newCipher = chacha20poly1305(newSharedSecret, newNonce);

    const reEncryptedKeyShare = newCipher.encrypt(decryptedKeyShare);

    const ciphertext = reEncryptedKeyShare.slice(0, -16);
    const authTag = reEncryptedKeyShare.slice(-16);

    return {
        encryptedKeyShare: bytesToHexString(ciphertext),
        ephemeralPublicKey: bytesToHexString(ephermalPubKey),
        nonce: bytesToHexString(newNonce),
        authTag: bytesToHexString(authTag),
    };
};

/**
 * Creates a payload for the smart contract
 * @param {Object} shareData - The re-encrypted share data
 * @returns {Array} - The payload array
 */
const createPayload = (shareData: any): Array<any> => {
    // Creating two identical entries with role 3
    return [{ role: 3, ...shareData }];
};

/**
 * Handles the key share re-encryption process
 * @param {Object} log - The event log
 */
const handleKeyShareReEncryption = async (log: any) => {
    const shares = log.args.encryptedKeyShares;
    const requestId = log.args.requestId;
    const requesterPubKey = normalizeHexString(log.args.requesterPublicKey);

    console.info(
        chalk.bgBlue.white.bold(
            `\n\n\n==== Share re-encryption has begun for request ID: ${requestId} ====\n`
        )
    );

    for (const [index, share] of shares.entries()) {
        try {
            // Decrypt the key share
            const decryptedKeyShare = decryptKeyShare(share);

            // Re-encrypt the key share for the requester
            const reEncryptedShareData = reEncryptKeyShare(
                decryptedKeyShare,
                requesterPubKey
            );

            // Create the payload
            const payload = createPayload(reEncryptedShareData);

            console.log(
                chalk.cyan(
                    `Submitting re-encrypted share for request ID: ${requestId}`
                )
            );

            // Submit the re-encrypted share to the contract
            const txHash = await writeContract.write.submitReEncryptedShare([
                log.args.requestId,
                true,
                payload,
            ]);

            console.log(
                chalk.green(
                    `Transaction submitted for request ID: ${requestId}.\nTxHash: ${txHash}`
                )
            );

            if (txHash) {
                console.info(
                    chalk.bgGreen.white.bold(
                        `\n==== Share re-encryption succeeded for request ID: ${requestId} ====`
                    )
                );
                break; // Break the loop once the transaction is successfully submitted
            }
        } catch (error) {
            console.warn(
                chalk.bgYellow.black(
                    `Received invalid share for request ID: ${requestId}, skipping to the next share..\n`
                )
            );

            if (index === shares.length - 1) {
                console.error(
                    chalk.bgRed.white.bold(
                        `\n==== Share re-encryption failed for request ID: ${requestId} ====`
                    )
                );
            }
            continue;
        }
    }
};

// Initialize Express app
const app = express();
const port = 3000;

// Set up contract event listener
const EVENT_NAME = "KeySharesRequested";
pubClient.watchContractEvent({
    address: contractAddress,
    abi,
    eventName: EVENT_NAME,
    onLogs: (logs) => {
        logs.forEach(handleKeyShareReEncryption);
    },
});

// Start the server
app.listen(port, () => {
    console.log(
        chalk.magenta.bold(
            `Oracle is running and listening for events from contract:`
        ) + chalk.bgMagenta.white.bold(`\n${contractAddress}\n`)
    );

    console.log(
        chalk.white.bold(`Oracle's ECDH X25519 Public Key:`) +
            chalk.bgWhite.black.bold(
                `\n${bytesToHex(x25519.getPublicKey(oracleCryptoPrivKey))}\n`
            )
    );
});

// const snowtraceDummyTuple = [
//     "0x62433469315a4a473558704c57616474",
//     [
//         [
//             2,
//             "0xa4c01ee5a5d6a4a75952609521639b777a5acac9e0f6d008484b1d0108ad9835",
//             "0x826621eba11dd1764eaa533baae11eb08c209b68c8d8049d458ac8db7bd28e32",
//             "0x6bed2e67833c56a74a72ee8c",
//             "0xd3ae4359f98c2a19add6ddf2851e4af0",
//         ],
//         [
//             1,
//             "0x965051a798f579aa1e1ca8a0544da9f97507c8f299912d29331d3604ea741307",
//             "0xb26fd9c5fae0a924b902a846c38f1779f367fff96a8318958e02691b3840513d",
//             "0xea6a9f7ce861ce55d6823d01",
//             "0x2d13183e76bac49d91c0bca3725342df",
//         ],
//         [
//             0,
//             "0x2453d5d5d1f14a2e40431bd3e6056f8a4a1a28576f795866334ae7df88c1d09a",
//             "0x70883366229491ffd6235d169c7b0d16449f516277032f3a3fd1dc60d92c0b77",
//             "0xaca42723c71a9ab44782acdc",
//             "0x0be88d7a297893156db42ee96981bc83",
//         ],
//         [
//             3,
//             "0x485cb7aab28b7a6dd183024882044455cacf0ac4b845a4f1b1a4ca270b5159f1",
//             "0xb49f3574b86e044d53d8a67121d4ec046ac6f3c97ae5510244e80bd1c9b56158",
//             "0xee9ad63dcd3399c56f2ed50b",
//             "0x3d2b775d0cf4237ab0358403b255cca9",
//         ],
//         [
//             3,
//             "0x485cb7aab28b7a6dd183024882044455cacf0ac4b845a4f1b1a4ca270b5159f1",
//             "0xb49f3574b86e044d53d8a67121d4ec046ac6f3c97ae5510244e80bd1c9b56158",
//             "0xee9ad63dcd3399c56f2ed50b",
//             "0x3d2b775d0cf4237ab0358403b255cca9",
//         ],
//     ],
//     "0x4ca60810b63cbf5b398f7447",
//     "0x5966b7b33afcba3e5429d7c2102a9711",
// ];
