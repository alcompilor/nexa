/**
 * NexaEHR Benchmarking Suite for Avalanche Fuji Testnet
 *
 * This script benchmarks a healthcare blockchain system (NexaEHR) that manages Electronic Health Records (EHR).
 * It measures performance metrics for various operations including:
 * - User registration and management (patients and physicians)
 * - EHR record storage and retrieval (both on-chain and IPFS)
 * - Oracle-assisted operations for privacy-preserving data sharing
 *
 * The benchmarks are performed on the Avalanche Fuji testnet to simulate real-world performance
 * in a decentralized healthcare data management system.
 */

// Standard Node.js modules
import { randomBytes } from "crypto";
import * as fs from "fs";
import path from "path";
import { performance } from "perf_hooks";

// Environment configuration
import dotenv from "dotenv";

// Third-party libraries
import { ethers } from "ethers";
import { x25519 } from "@noble/curves/ed25519";
import { bytesToHex } from "@noble/hashes/utils";
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";

// Local modules/artifacts
import NexaEHR from "../NexaEHR.json";

// Load environment variables from .env file
dotenv.config();

/**
 * Interface for performance metrics collected during benchmarking
 */
interface Metric {
    duration: number; // Operation duration in milliseconds
    timestamp: string; // ISO timestamp when the operation was performed
    error: string | null; // Error message if operation failed, null otherwise
    gasUsed?: string; // Gas used by blockchain transaction (if applicable)
    effectiveGasPrice?: string; // Gas price for transaction (if applicable)
    blockNumber?: number; // Block number where transaction was included (if applicable)
    [key: string]: any; // Additional custom parameters
}

// Configuration constants
const AVALANCHE_TESTNET_RPC_URL = process.env.AVALANCHE_TESTNET_RPC_URL!;
const RECORD_ITERATIONS = Number(process.env.RECORD_MANAGEMENT_ITERATIONS!); // Number of EHR records to benchmark
const ROLE_ITERATIONS = Number(process.env.ROLE_MANAGEMENT_ITERATIONS!); // Number of role registration operations to benchmark
const DATASET_DIR = "./dataset"; // Directory containing the EHR records

/**
 * Private keys for test accounts from environment variables
 * These represent different actors in the healthcare system
 */
const PRIVATE_KEYS = {
    hospital: process.env.HOSPITAL_PRIVATE_KEY, // Hospital/healthcare provider
    patient: process.env.PATIENT_PRIVATE_KEY, // Patient/data subject
    physician: process.env.PHYSICIAN_PRIVATE_KEY, // Doctor/healthcare professional
    oracle1: process.env.ORACLE1_PRIVATE_KEY, // First trusted oracle for key management
    oracle2: process.env.ORACLE2_PRIVATE_KEY, // Second trusted oracle for key management
};

// Verify all required keys are available
Object.entries(PRIVATE_KEYS).forEach(([name, key]) => {
    if (!key) {
        throw new Error(`Missing ${name} private key in .env file`);
    }
});

/**
 * Data structure to store all benchmark results
 */
const benchmarkResults = {
    // Basic information about the benchmark environment
    environmentInfo: {
        network: "Avalanche Fuji Testnet",
        rpcUrl: AVALANCHE_TESTNET_RPC_URL,
        timestamp: new Date().toISOString(),
    },
    // Metrics for contract deployment
    deploymentMetrics: {},
    // Metrics for each operation type (addPatient, addRecord, etc.)
    operationMetrics: {} as Record<
        string,
        {
            duration: number;
            timestamp: string;
            error: string | null;
            gasUsed?: string;
            effectiveGasPrice?: string;
            blockNumber?: number;
        }[]
    >,
    // Mapping of content IDs to IPFS file keys for retrieval
    records: {} as Record<string, string>,
};

/**
 * Creates an X25519 keypair from an existing private key
 * @param privKey Ethereum private key (with or without 0x prefix)
 * @returns Object containing privateKey and publicKey byte arrays
 */
function getKeypairFromPrivateKey(privKey: any) {
    const privateKeyBytes = Buffer.from(privKey.replace("0x", ""), "hex");
    const publicKey = x25519.getPublicKey(privateKeyBytes);
    return { privateKey: privateKeyBytes, publicKey };
}

/**
 * Generates a new random X25519 keypair for encryption
 * @returns Object containing privateKey and publicKey byte arrays
 */
function generateKeypair() {
    const privateKey = x25519.utils.randomPrivateKey();
    const publicKey = x25519.getPublicKey(privateKey);
    return { privateKey, publicKey };
}

/**
 * Loads EHR data from JSON file based on iteration number
 * @param iteration Record number to load from dataset
 * @returns Parsed JSON object containing EHR data
 */
function loadEHRData(iteration: number) {
    const filePath = path.join(DATASET_DIR, `${iteration}.json`);
    try {
        const fileData = fs.readFileSync(filePath, "utf8");
        return JSON.parse(fileData);
    } catch (error) {
        console.error(`Error loading EHR data from ${filePath}:`, error);
        throw error;
    }
}

/**
 * Initialize AWS S3 client for Filebase (IPFS gateway)
 * Filebase provides S3-compatible API for IPFS storage
 */
const s3Client = new S3Client({
    endpoint: "https://s3.filebase.com",
    region: "us-east-1",
    credentials: {
        accessKeyId: process.env.FILEBASE_ACCESS_KEY!,
        secretAccessKey: process.env.FILEBASE_SECRET_KEY!,
    },
    forcePathStyle: true,
});

/**
 * Stores data on IPFS through Filebase S3-compatible API
 * @param data JSON data to store
 * @param name Filename identifier
 * @returns Object containing IPFS CID, filename, and operation duration
 */
export async function ipfsStorage(data: any, name: string) {
    const startTime = performance.now();

    const jsonBuffer = Buffer.from(JSON.stringify(data));
    const fileKey = `${name}.json`;

    const command = new PutObjectCommand({
        Bucket: process.env.FILEBASE_BUCKET!,
        Key: fileKey,
        Body: jsonBuffer,
        ContentType: "application/json",
        ACL: "public-read",
    });

    // Add middleware to extract the IPFS CID from response headers
    command.middlewareStack.add(
        (next) => async (args) => {
            const response = await next(args);
            if ((response.response as any)?.headers) {
                const cid = (
                    response.response as { headers: Record<string, string> }
                )?.headers["x-amz-meta-cid"];
                if (cid) {
                    // Attach CID to output so it is available outside
                    (response as any).cid = cid;
                }
            }
            return response;
        },
        {
            step: "build",
            name: "addCidToOutput",
        }
    );

    const res = await s3Client.send(command);
    const endTime = performance.now();

    return {
        cid: (res as any).cid, // Extracted from middleware if available
        fileKey,
        duration: endTime - startTime,
    };
}

/**
 * Retrieves data from IPFS through Filebase S3-compatible API
 * @param fileKey File identifier (name.json)
 * @returns Object containing retrieved data and operation duration
 */
async function ipfsRetrieve(fileKey: string) {
    const startTime = performance.now();

    try {
        const command = new GetObjectCommand({
            Bucket: process.env.FILEBASE_BUCKET!, // Your bucket name
            Key: fileKey, // The file key
        });

        const res = await s3Client.send(command);

        if (!res.Body) {
            throw new Error("No file body received from Filebase");
        }

        const bodyString = await streamToString(res.Body as any);
        const jsonData = JSON.parse(bodyString);

        const endTime = performance.now();

        return {
            data: jsonData,
            duration: endTime - startTime,
        };
    } catch (error) {
        console.error("Error retrieving file from IPFS:", error);
        throw error;
    }
}

/**
 * Helper function to convert a stream to string
 * @param stream Readable stream
 * @returns Promise resolving to string content
 */
function streamToString(stream: any): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on("data", (chunk: any) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () =>
            resolve(Buffer.concat(chunks).toString("utf-8"))
        );
    });
}

/**
 * Creates an encrypted key share for a specific role
 * This simulates the encryption of a symmetric key share with a role's public key
 *
 * @param role Role identifier (0=Hospital, 1=Patient, 2=Physician, 3=Oracle)
 * @returns Object containing encrypted share data
 */
function createEncryptedShare(role: number) {
    // In a real system, these would be actual encrypted values
    // Here we generate random bytes to simulate the encryption
    const keyShare = randomBytes(32); // Random key share
    const ephemeralKeyPair = generateKeypair(); // Create ephemeral keypair for encryption
    const nonce = randomBytes(12); // Randomization nonce
    const authTag = randomBytes(16); // Authentication tag

    return {
        role,
        encryptedKeyShare: `0x${bytesToHex(keyShare)}`,
        ephemeralPublicKey: `0x${bytesToHex(ephemeralKeyPair.publicKey)}`,
        nonce: `0x${bytesToHex(nonce)}`,
        authTag: `0x${bytesToHex(authTag)}`,
    };
}

/**
 * Creates a simulated encrypted EHR record with the actual IPFS CID
 * This creates a record structure with encrypted key shares that would
 * allow different roles to access the encrypted data on IPFS
 *
 * @param contentCid IPFS CID of the stored EHR data
 * @param fileKey S3/Filebase key for retrieval
 * @returns Record object ready for blockchain storage
 */
function createRecord(contentCid: string, fileKey: string) {
    // Convert the CID to a hex string for blockchain storage
    const contentIdBytes = Buffer.from(contentCid);
    const contentId = `0x${contentIdBytes.toString("hex")}`;

    // Create encrypted key shares for different roles
    const encryptedKeyShares = [
        createEncryptedShare(2), // Physician
        createEncryptedShare(1), // Patient
        createEncryptedShare(0), // Hospital
        createEncryptedShare(3), // Oracle 1
        createEncryptedShare(3), // Oracle 2
    ];

    // Create nonce and auth tag for the record encryption
    const nonce = `0x${bytesToHex(randomBytes(12))}`;
    const authTag = `0x${bytesToHex(randomBytes(16))}`;

    // Construct the record object
    const record = {
        contentId,
        encryptedKeyShares,
        nonce,
        authTag,
    };

    // Store mapping of contentId to fileKey for retrieval
    benchmarkResults.records[contentId] = fileKey;

    return record;
}

/**
 * Main benchmarking test suite for NexaEHR on Avalanche Fuji
 * Uses Mocha test framework to organize benchmark operations
 */
describe("NexaEHR Benchmarking on Avalanche Fuji", function () {
    // Set longer timeout for network operations
    this.timeout(600000); // 10 minutes

    // Contract and signer variables
    let nexaEHR: any;
    let hospitalSigner: any,
        patientSigner: any,
        physicianSigner: any,
        oracle1Signer: any,
        oracle2Signer;
    let nexaEHRAddress;

    // Convert X25519 keypairs to hex strings for contract functions
    const hospitalKeyPair = getKeypairFromPrivateKey(PRIVATE_KEYS.hospital);
    const oracle1KeyPair = getKeypairFromPrivateKey(PRIVATE_KEYS.oracle1);
    const oracle2KeyPair = getKeypairFromPrivateKey(PRIVATE_KEYS.oracle2);
    const patientKeyPair = getKeypairFromPrivateKey(PRIVATE_KEYS.patient);
    const physicianKeyPair = getKeypairFromPrivateKey(PRIVATE_KEYS.physician);

    // Format public keys as hex strings with 0x prefix
    const hospitalPublicKeyHex = `0x${Buffer.from(
        hospitalKeyPair.publicKey
    ).toString("hex")}`;
    const oracle1PublicKeyHex = `0x${Buffer.from(
        oracle1KeyPair.publicKey
    ).toString("hex")}`;
    const oracle2PublicKeyHex = `0x${Buffer.from(
        oracle2KeyPair.publicKey
    ).toString("hex")}`;
    const patientPublicKeyHex = `0x${Buffer.from(
        patientKeyPair.publicKey
    ).toString("hex")}`;
    const physicianPublicKeyHex = `0x${Buffer.from(
        physicianKeyPair.publicKey
    ).toString("hex")}`;

    /**
     * Helper function to measure and log operation time and metrics
     * @param name Operation name identifier
     * @param operation Async function to execute and measure
     * @param params Additional parameters to include in metrics
     * @returns Object containing result, duration, and transaction receipt
     */
    async function measureOperation(name: any, operation: any, params = {}) {
        const startTime = performance.now();
        let result;
        let error = null;
        let txReceipt = null;

        try {
            result = await operation();

            // If result is a transaction response, wait for receipt
            if (result && result.wait) {
                txReceipt = await result.wait();
            }
        } catch (err) {
            error = err;
            console.error(`Error in ${name}:`, err);
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        // Log metric
        console.log(`${name}: ${duration.toFixed(2)}ms`);

        // Save metric to results
        if (!benchmarkResults.operationMetrics[name]) {
            benchmarkResults.operationMetrics[name] = [];
        }

        const metric = {
            duration,
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
            ...params,
        } as Metric;

        // Add blockchain transaction details if available
        if (txReceipt) {
            metric.gasUsed = txReceipt.gasUsed.toString();
            metric.effectiveGasPrice = txReceipt.effectiveGasPrice.toString();
            metric.blockNumber = txReceipt.blockNumber;
        }

        benchmarkResults.operationMetrics[name].push(metric);

        if (error) {
            throw error;
        }

        return { result, duration, txReceipt };
    }

    /**
     * Setup function runs once before all tests
     * Deploys the NexaEHR contract and sets up signers
     */
    before(async function () {
        // Connect to Avalanche Fuji testnet
        const provider = new ethers.providers.JsonRpcProvider(
            AVALANCHE_TESTNET_RPC_URL
        );

        // Set up blockchain account signers from private keys
        hospitalSigner = new ethers.Wallet(PRIVATE_KEYS.hospital!, provider);
        patientSigner = new ethers.Wallet(PRIVATE_KEYS.patient!, provider);
        physicianSigner = new ethers.Wallet(PRIVATE_KEYS.physician!, provider);
        oracle1Signer = new ethers.Wallet(PRIVATE_KEYS.oracle1!, provider);
        oracle2Signer = new ethers.Wallet(PRIVATE_KEYS.oracle2!, provider);

        // Log addresses for reference
        console.log("Hospital address:", hospitalSigner.address);
        console.log("Patient address:", patientSigner.address);
        console.log("Physician address:", physicianSigner.address);
        console.log("Oracle 1 address:", oracle1Signer.address);
        console.log("Oracle 2 address:", oracle2Signer.address);

        // Deploy NexaEHR contract
        const startDeployTime = performance.now();

        console.log("Deploying NexaEHR contract...");
        const NexaEHRFactory = new ethers.ContractFactory(
            NexaEHR.abi,
            NexaEHR.bytecode,
            hospitalSigner
        );

        // Deploy contract with initial trusted public keys
        nexaEHR = await NexaEHRFactory.deploy(
            hospitalPublicKeyHex,
            oracle1PublicKeyHex,
            oracle2PublicKeyHex
        );

        const deployTx = await nexaEHR.deployTransaction.wait();
        const endDeployTime = performance.now();

        nexaEHRAddress = nexaEHR.address;
        console.log("NexaEHR deployed at:", nexaEHRAddress);

        // Save deployment metrics
        benchmarkResults.deploymentMetrics = {
            contractAddress: nexaEHRAddress,
            deploymentTime: endDeployTime - startDeployTime,
            gasUsed: deployTx.gasUsed.toString(),
            blockNumber: deployTx.blockNumber,
            transactionHash: deployTx.transactionHash,
            timestamp: new Date().toISOString(),
        };

        // Set up contract instance for hospital signer
        nexaEHR = nexaEHR.connect(hospitalSigner);
    });

    /**
     * Test suite for user registration operations
     * Measures performance of adding and revoking patients and physicians
     */
    describe("User Registration", function () {
        for (let i = 0; i < ROLE_ITERATIONS; i++) {
            it(
                "should register a patient with latency measurement" +
                    `(iteration: ${i})`,
                async function () {
                    await measureOperation("addPatient", async () => {
                        return await nexaEHR
                            .connect(patientSigner)
                            .addPatient(patientPublicKeyHex);
                    });
                }
            );

            if (i < ROLE_ITERATIONS - 1) {
                it(
                    "should revoke a patient with latency measurement" +
                        `(iteration: ${i})`,
                    async function () {
                        await measureOperation("revokePatient", async () => {
                            return await nexaEHR
                                .connect(patientSigner)
                                .revokePatient();
                        });
                    }
                );
            }

            it(
                "should register a physician with latency measurement" +
                    `(iteration: ${i})`,
                async function () {
                    await measureOperation("addPhysician", async () => {
                        return await nexaEHR
                            .connect(hospitalSigner)
                            .addPhysician(
                                physicianSigner.address,
                                physicianPublicKeyHex
                            );
                    });
                }
            );

            if (i < ROLE_ITERATIONS - 1) {
                it(
                    "should revoke a physician with latency measurement" +
                        `(iteration: ${i})`,
                    async function () {
                        await measureOperation("revokePhysician", async () => {
                            return await nexaEHR
                                .connect(hospitalSigner)
                                .revokePhysician(physicianSigner.address);
                        });
                    }
                );
            }
        }
    });

    /**
     * Test suites for each dataset record
     * Measures IPFS storage, blockchain record addition, and retrieval performance
     */
    for (let i = 1; i <= RECORD_ITERATIONS; i++) {
        describe(`Dataset Record ${i}`, function () {
            let recordCID: string;
            let fileKey: string;

            it(`should measure IPFS storage latency for record ${i}`, async function () {
                // Load EHR data from file
                const ehrData = loadEHRData(i);

                // Store on IPFS using Filebase
                await measureOperation(
                    "ipfsStorage",
                    async () => {
                        const {
                            cid,
                            fileKey: key,
                            duration,
                        } = await ipfsStorage(ehrData, String(i));
                        recordCID = cid;
                        fileKey = key;
                    },
                    { recordNumber: i }
                );

                console.log(`Stored record ${i} with CID: ${recordCID}`);
            });

            it(`should add record ${i} to blockchain`, async function () {
                // Create a record with the actual CID
                const record = createRecord(recordCID, fileKey);

                // Add the record and measure latency
                const { txReceipt } = await measureOperation(
                    "addRecord",
                    async () => {
                        return await nexaEHR
                            .connect(physicianSigner)
                            .addRecord(patientSigner.address, record);
                    },
                    { recordNumber: i }
                );

                console.log(`Gas used: ${txReceipt.gasUsed.toString()}`);
            });

            it(`should retrieve record ${i} from blockchain`, async function () {
                const { result } = await measureOperation(
                    "getLatestRecord",
                    async () => {
                        return await nexaEHR
                            .connect(physicianSigner)
                            .getLatestRecord(patientSigner.address);
                    },
                    { recordNumber: i }
                );

                // Store the contentId for later IPFS retrieval
                const contentId = result.contentId;
                console.log(`Retrieved record with contentId: ${contentId}`);
            });

            it(`should retrieve record ${i} data from IPFS`, async function () {
                // Get latest record from blockchain
                const latestRecord = await nexaEHR
                    .connect(physicianSigner)
                    .getLatestRecord(patientSigner.address);

                // Get the fileKey associated with this contentId
                const retrieveKey =
                    benchmarkResults.records[latestRecord.contentId] || fileKey;

                // Actually retrieve from IPFS
                await measureOperation(
                    "ipfsRetrieve",
                    async () => ipfsRetrieve(retrieveKey),
                    { recordNumber: i }
                );
            });
        });
    }

    /**
     * Test suite for oracle operations
     * Measures performance of oracle-assisted data sharing
     */
    describe("Oracle Operations", function () {
        it("should request oracle assistance", async function () {
            // Get latest record
            const latestRecord = await nexaEHR
                .connect(physicianSigner)
                .getLatestRecord(patientSigner.address);

            // Generate request ID
            const requestId = `0x${bytesToHex(randomBytes(16))}`;

            // Request oracle assistance and measure latency
            await measureOperation("requestOracleAssistance", async () => {
                return await nexaEHR
                    .connect(physicianSigner)
                    .requestOracleAssistance(requestId, latestRecord);
            });
        });

        it("should simulate oracle response time", async function () {
            // Generate request ID and mock reencrypted shares
            const requestId = `0x${bytesToHex(randomBytes(16))}`;
            const reEncryptedShares = [
                createEncryptedShare(3),
                createEncryptedShare(3),
            ];

            // Submit reencrypted shares and measure latency
            await measureOperation("submitReEncryptedShare", async () => {
                return await nexaEHR
                    .connect(oracle1Signer)
                    .submitReEncryptedShare(requestId, true, reEncryptedShares);
            });
        });
    });

    /**
     * Cleanup function runs after all tests
     * Saves benchmark results and generates summary statistics
     */
    after(function () {
        const timestamp = new Date().toISOString().replace(/:/g, "-");
        // Save benchmark results to file with timestamp
        const resultsPath = `${__dirname}/benchmark-results-${timestamp}.json`;
        fs.writeFileSync(
            resultsPath,
            JSON.stringify(benchmarkResults, null, 2)
        );
        console.log(`Benchmark results saved to ${resultsPath}`);

        const summaryLines: string[] = [];
        function logBoth(message: string) {
            console.log(message);
            summaryLines.push(message);
        }

        logBoth("\n=== BENCHMARK SUMMARY ===");

        Object.entries(benchmarkResults.operationMetrics).forEach(
            ([operation, metrics]) => {
                const durations = metrics.map((m) => m.duration);
                const avg =
                    durations.reduce((sum, val) => sum + val, 0) /
                    durations.length;
                const min = Math.min(...durations);
                const max = Math.max(...durations);

                logBoth(`\n${operation}:`);
                logBoth(`  Average: ${avg.toFixed(2)}ms`);
                logBoth(`  Min: ${min.toFixed(2)}ms`);
                logBoth(`  Max: ${max.toFixed(2)}ms`);

                if (metrics[0].gasUsed) {
                    const gasUsed = metrics.map((m) => parseInt(m.gasUsed!));
                    const avgGas =
                        gasUsed.reduce((sum, val) => sum + val, 0) /
                        gasUsed.length;
                    logBoth(`  Average Gas: ${avgGas.toFixed(0)}`);
                }
            }
        );

        // Save summary to file
        fs.writeFileSync(
            `${__dirname}/benchmark-summary-${timestamp}`,
            summaryLines.join("\n"),
            "utf-8"
        );
    });
});
