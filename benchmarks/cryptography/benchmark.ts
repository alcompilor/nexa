import { performance, PerformanceObserver } from "node:perf_hooks";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { randomBytes } from "@noble/ciphers/webcrypto";
import * as SSS from "shamirs-secret-sharing-ts";
import { x25519 } from "@noble/curves/ed25519";
import { fileURLToPath } from "url";
import { dirname } from "path";

// ======================
// Type Definitions
// ======================
type Role = "Hospital" | "Patient" | "Physician" | "Oracle1" | "Oracle2";

interface EncryptedShare {
    role: Role;
    encryptedKeyShare: Uint8Array;
    ephemeralPublicKey: Uint8Array;
    nonce: Uint8Array;
    authTag: Uint8Array;
}

interface EHR {
    contentId: Uint8Array;
    content: Uint8Array;
    encryptedKeyShares: EncryptedShare[];
    nonce: Uint8Array;
    authTag: Uint8Array;
}

// ======================
// Configuration
// ======================
const ROLES: Role[] = [
    "Hospital",
    "Patient",
    "Physician",
    "Oracle1",
    "Oracle2",
];
const DATASET_PATH = "./dataset";

// ======================
// Cryptographic Setup
// ======================
const ACTORS_PRIVATE_KEYS: Record<Role, Uint8Array> = {
    Hospital: x25519.utils.randomPrivateKey(),
    Patient: x25519.utils.randomPrivateKey(),
    Physician: x25519.utils.randomPrivateKey(),
    Oracle1: x25519.utils.randomPrivateKey(),
    Oracle2: x25519.utils.randomPrivateKey(),
};

const ACTORS_PUBLIC_KEYS: Record<Role, Uint8Array> = Object.fromEntries(
    Object.entries(ACTORS_PRIVATE_KEYS).map(([role, privKey]) => [
        role,
        x25519.getPublicKey(privKey),
    ])
) as Record<Role, Uint8Array>;

// Helper functions
function toBuffer(uint8array: Uint8Array): Buffer {
    return Buffer.from(
        uint8array.buffer,
        uint8array.byteOffset,
        uint8array.byteLength
    );
}

function toUint8Array(buffer: Buffer): Uint8Array {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

// ======================
// Core Functions
// ======================
async function encryptFile(fileContent: Uint8Array): Promise<EHR> {
    const fileKey = randomBytes(32);
    const fileNonce = randomBytes(12);
    const fileCipher = chacha20poly1305(fileKey, fileNonce);
    const encryptedContent = fileCipher.encrypt(fileContent);
    const authTag = encryptedContent.slice(-16);
    const ciphertext = encryptedContent.slice(0, -16);

    const shares = SSS.split(toBuffer(fileKey), {
        shares: 5,
        threshold: 3,
    }).map((share: any) => toUint8Array(share));

    const encryptedShares = await Promise.all(
        ROLES.map(async (role, index) => {
            const ephemeralPrivateKey = x25519.utils.randomPrivateKey();
            const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);

            const sharedSecret = x25519
                .getSharedSecret(ephemeralPrivateKey, ACTORS_PUBLIC_KEYS[role])
                .slice(0, 32);

            const shareNonce = randomBytes(12);
            const shareCipher = chacha20poly1305(sharedSecret, shareNonce);
            const encryptedShare = shareCipher.encrypt(shares[index]);
            const shareAuthTag = encryptedShare.slice(-16);
            const shareCiphertext = encryptedShare.slice(0, -16);

            return {
                role,
                encryptedKeyShare: shareCiphertext,
                ephemeralPublicKey,
                nonce: shareNonce,
                authTag: shareAuthTag,
            };
        })
    );

    return {
        contentId: randomBytes(64),
        content: ciphertext,
        encryptedKeyShares: encryptedShares,
        nonce: fileNonce,
        authTag: authTag,
    };
}

async function decryptFile(record: EHR): Promise<Uint8Array> {
    const decryptedShares = await Promise.all(
        record.encryptedKeyShares.slice(0, 3).map(async (share) => {
            const sharedSecret = x25519
                .getSharedSecret(
                    ACTORS_PRIVATE_KEYS[share.role],
                    share.ephemeralPublicKey
                )
                .slice(0, 32);

            const shareCipher = chacha20poly1305(sharedSecret, share.nonce);
            const encryptedShare = new Uint8Array([
                ...share.encryptedKeyShare,
                ...share.authTag,
            ]);
            return shareCipher.decrypt(encryptedShare);
        })
    );

    const fileKey = toUint8Array(
        SSS.combine(decryptedShares.map((share: any) => toBuffer(share)))
    );

    const fileCipher = chacha20poly1305(fileKey, record.nonce);
    const encryptedContent = new Uint8Array(
        record.content.length + record.authTag.length
    );
    encryptedContent.set(record.content, 0);
    encryptedContent.set(record.authTag, record.content.length);

    return fileCipher.decrypt(encryptedContent);
}

// Utility function to compare original and decrypted content
function compareUint8Arrays(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

// ======================
// Benchmarking and Result Storage
// ======================
async function runBenchmark() {
    const obs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        console.log("\n=== Benchmark Summary ===");
        console.table(
            entries.map((entry) => ({
                Operation: entry.name,
                "Duration (ms)": entry.duration.toFixed(3),
            }))
        );
    });
    obs.observe({ entryTypes: ["measure"], buffered: true });

    const encryptedRecords: EHR[] = [];
    const encryptDurations: number[] = [];
    const decryptDurations: number[] = [];
    const fileResults: { [key: string]: any }[] = [];

    console.log("Starting benchmark with 1000 records...\n");

    for (let i = 1; i <= 1000; i++) {
        const fileId = `Record ${i}`;
        const filePath = `${DATASET_PATH}/${i}.json`;

        try {
            const content = readFileSync(filePath);

            // Encrypt
            performance.mark(`${fileId}-encrypt-start`);
            const encrypted = await encryptFile(content);
            performance.mark(`${fileId}-encrypt-end`);
            performance.measure(
                `${fileId} Encryption`,
                `${fileId}-encrypt-start`,
                `${fileId}-encrypt-end`
            );
            const encryptDuration =
                performance.getEntriesByName(`${fileId} Encryption`).pop()
                    ?.duration ?? 0;

            // Decrypt
            performance.mark(`${fileId}-decrypt-start`);
            const decrypted = await decryptFile(encrypted);
            performance.mark(`${fileId}-decrypt-end`);
            performance.measure(
                `${fileId} Decryption`,
                `${fileId}-decrypt-start`,
                `${fileId}-decrypt-end`
            );
            const decryptDuration =
                performance.getEntriesByName(`${fileId} Decryption`).pop()
                    ?.duration ?? 0;

            // Check correctness
            const isMatch = compareUint8Arrays(content, decrypted);

            const statusSymbol = isMatch ? "✔" : "❌";
            const matchNote = isMatch ? "" : " (mismatch!)";

            console.log(
                `${statusSymbol} ${fileId} - Encrypt: ${encryptDuration.toFixed(
                    2
                )} ms, Decrypt: ${decryptDuration.toFixed(2)} ms${matchNote}`
            );

            encryptedRecords.push(encrypted);
            encryptDurations.push(encryptDuration);
            decryptDurations.push(decryptDuration);

            // Store file-specific results
            fileResults.push({
                fileId,
                encryptDuration,
                decryptDuration,
                status: isMatch ? "success" : "failure",
            });
        } catch (err) {
            console.error(`✖ Error processing ${filePath}:`, err);
        }
    }

    // Calculate min, max, and mean for encryption and decryption
    const encryptStats = {
        min: Math.min(...encryptDurations),
        max: Math.max(...encryptDurations),
        mean:
            encryptDurations.reduce((a, b) => a + b, 0) /
            encryptDurations.length,
    };

    const decryptStats = {
        min: Math.min(...decryptDurations),
        max: Math.max(...decryptDurations),
        mean:
            decryptDurations.reduce((a, b) => a + b, 0) /
            decryptDurations.length,
    };

    const timestamp = new Date().toISOString();

    // Save summary to a text file
    const summary = `
        === Benchmark Summary ===
        Encryption:
            Min: ${encryptStats.min.toFixed(2)} ms
            Max: ${encryptStats.max.toFixed(2)} ms
            Mean: ${encryptStats.mean.toFixed(2)} ms
        Decryption:
            Min: ${decryptStats.min.toFixed(2)} ms
            Max: ${decryptStats.max.toFixed(2)} ms
            Mean: ${decryptStats.mean.toFixed(2)} ms
    `.replace(/^\s+/gm, ""); // This removes leading spaces or tabs from each line
    writeFileSync(`${__dirname}/benchmark-summary-${timestamp}`, summary);

    // Save all file results to a JSON file
    const benchmarkResults = {
        files: fileResults,
    };
    writeFileSync(
        `${__dirname}/benchmark-results-${timestamp}.json`,
        JSON.stringify(benchmarkResults, null, 2)
    );

    obs.disconnect();
}

// ======================
// Execution
// ======================
(async () => {
    try {
        await runBenchmark();
    } catch (error) {
        console.error("Benchmark failed:", error);
        process.exit(1);
    }
})();
