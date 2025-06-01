import { expect } from "chai";
import { createTestClient, http, publicActions, walletActions } from "viem";
import { hardhat } from "viem/chains";
import { x25519 } from "@noble/curves/ed25519";
import NexaEHR from "../artifacts/contracts/NexaEHR.sol/NexaEHR.json"; // Import your ABI
import { randomBytes } from "crypto";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

// account 0 = Hospital
// account 1 = Patient
// account 2 = Physician

const NexaEHRAbi = NexaEHR.abi;

// Helper to create a keypair
function generateKeypair() {
    const privateKey = x25519.utils.randomPrivateKey();
    const publicKey = x25519.getPublicKey(privateKey);
    return { privateKey, publicKey };
}

// Generate keypairs
const hospitalKeyPair = generateKeypair();
const oracle1KeyPair = generateKeypair();
const oracle2KeyPair = generateKeypair();
const patientKeyPair = generateKeypair();
const physicianKeyPair = generateKeypair();

// Helper to create 32-byte key shares
function createKeyShare() {
    return randomBytes(32);
}

// Helper to create encrypted share
function createEncryptedShare(role: number, publicKey: any) {
    const keyShare = createKeyShare();
    const ephemeralKeyPair = generateKeypair();
    const nonce = randomBytes(12);
    const authTag = randomBytes(16);

    return {
        role,
        encryptedKeyShare: `0x${bytesToHex(keyShare)}`,
        ephemeralPublicKey: `0x${bytesToHex(ephemeralKeyPair.publicKey)}`,
        nonce: `0x${bytesToHex(nonce)}`,
        authTag: `0x${bytesToHex(authTag)}`,
    };
}

// Helper to create a mock record with encrypted shares
function createMockRecord() {
    // Create a mock CID (content identifier)
    const contentId = `0x${bytesToHex(randomBytes(46))}`;

    // Create 5 encrypted shares for different roles
    const encryptedKeyShares = [
        createEncryptedShare(2, null), // Physician
        createEncryptedShare(1, null), // Patient
        createEncryptedShare(0, null), // Hospital
        createEncryptedShare(3, null), // Oracle 1
        createEncryptedShare(3, null), // Oracle 2
    ];

    // Create nonce and auth tag for the record
    const nonce = `0x${bytesToHex(randomBytes(12))}`;
    const authTag = `0x${bytesToHex(randomBytes(16))}`;

    return {
        contentId,
        encryptedKeyShares,
        nonce,
        authTag,
    };
}

// Convert public keys to hex strings
const hospitalPublicKeyHex = `0x${Buffer.from(
    hospitalKeyPair.publicKey
).toString("hex")}`;
const oracle1PublicKeyHex = `0x${Buffer.from(oracle1KeyPair.publicKey).toString(
    "hex"
)}`;
const oracle2PublicKeyHex = `0x${Buffer.from(oracle2KeyPair.publicKey).toString(
    "hex"
)}`;

describe("NexaEHR", () => {
    let testClient: any;
    let nexaEHRAddress: `0x${string}`;
    let accounts: `0x${string}`[];

    before(async () => {
        // Setup viem test client
        testClient = createTestClient({
            chain: hardhat,
            mode: "hardhat",
            transport: http(),
        })
            .extend(publicActions)
            .extend(walletActions);

        // Get test accounts
        accounts = await testClient.getAddresses();

        // Deploy contract
        const deployHash = await testClient.deployContract({
            abi: NexaEHRAbi,
            bytecode: NexaEHR.bytecode, // Make sure your ABI JSON includes the bytecode
            account: accounts[0],
            args: [
                hospitalPublicKeyHex,
                oracle1PublicKeyHex,
                oracle2PublicKeyHex,
            ],
        });

        // Get contract address
        const txReceipt = await testClient.waitForTransactionReceipt({
            hash: deployHash,
        });
        nexaEHRAddress = txReceipt.contractAddress!;
    });

    // Helper function to read from contract
    async function readContract(
        functionName: string,
        args: any[] = [],
        account: `0x${string}` = accounts[0]
    ) {
        return testClient.readContract({
            address: nexaEHRAddress,
            abi: NexaEHRAbi,
            functionName,
            args,
            account,
        });
    }

    // Helper function to write to contract
    async function writeContract(
        functionName: string,
        args: any[],
        account: `0x${string}` = accounts[0]
    ) {
        const hash = await testClient.writeContract({
            address: nexaEHRAddress,
            abi: NexaEHRAbi,
            functionName,
            args,
            account,
        });
        await testClient.waitForTransactionReceipt({ hash });
        return hash;
    }

    it("should deploy the contract with the correct hospital address", async () => {
        const hospital = await readContract("hospital");
        expect(hospital).to.equal(accounts[0]);
    });

    it("should NOT update hospital ownership address (unauthorized)", async () => {
        await expect(
            writeContract(
                "updateHospital",
                [accounts[5], hospitalPublicKeyHex],
                accounts[8]
            )
        ).to.be.rejectedWith("Not authorized: Caller is not the hospital");
    });

    it("should update hospital ownership address", async () => {
        await expect(
            writeContract(
                "updateHospital",
                [accounts[0], hospitalPublicKeyHex],
                accounts[0]
            )
        ).to.be.fulfilled;
    });

    it("should add a patient", async () => {
        const patientPublicKeyHex = `0x${Buffer.from(
            patientKeyPair.publicKey
        ).toString("hex")}`;
        await writeContract("addPatient", [patientPublicKeyHex], accounts[1]);
        const patient = await readContract("addressToAgent", [accounts[1]]);

        expect(patient).to.deep.equal([1, true, patientPublicKeyHex]);
    });

    it("should revoke a patient and activate again", async () => {
        const patientPublicKeyHex = `0x${Buffer.from(
            patientKeyPair.publicKey
        ).toString("hex")}`;
        await writeContract("revokePatient", [], accounts[1]);
        const patientRevoked = await readContract("addressToAgent", [
            accounts[1],
        ]);

        expect(patientRevoked).to.deep.equal([1, false, patientPublicKeyHex]);

        await writeContract("addPatient", [patientPublicKeyHex], accounts[1]);
        const patientActive = await readContract("addressToAgent", [
            accounts[1],
        ]);

        expect(patientActive).to.deep.equal([1, true, patientPublicKeyHex]);
    });

    it("should add a physician", async () => {
        const physicianPublicKeyHex = `0x${Buffer.from(
            physicianKeyPair.publicKey
        ).toString("hex")}`;

        await writeContract(
            "addPhysician",
            [accounts[2], physicianPublicKeyHex],
            accounts[0]
        );
        const isPhysicianAuthorized = await readContract(
            "authorizedPhysiciansByHospital",
            [accounts[2]]
        );
        expect(isPhysicianAuthorized).to.equal(true);
    });

    it("should NOT add a physician (unauthorized hospital)", async () => {
        const physicianPublicKeyHex = `0x${Buffer.from(
            physicianKeyPair.publicKey
        ).toString("hex")}`;

        await expect(
            writeContract(
                "addPhysician",
                [accounts[3], physicianPublicKeyHex],
                accounts[1]
            )
        ).to.be.rejectedWith("Not authorized: Caller is not the hospital");
    });

    it("should revoke a physician", async () => {
        await writeContract("revokePhysician", [accounts[2]], accounts[0]);
        const isPhysicianAuthorized = await readContract(
            "authorizedPhysiciansByHospital",
            [accounts[2]]
        );
        expect(isPhysicianAuthorized).to.equal(false);
    });

    it("should prevent revoked physician from fetching data", async () => {
        await expect(
            readContract("getAgents", [accounts[1]], accounts[2])
        ).to.be.rejectedWith(
            "Not authorized: Physician not authorized by hospital"
        );
    });

    it("should activate revoked physician again and allow fetching data", async () => {
        const physicianPublicKeyHex = `0x${Buffer.from(
            physicianKeyPair.publicKey
        ).toString("hex")}`;

        const patientPublicKeyHex = `0x${Buffer.from(
            patientKeyPair.publicKey
        ).toString("hex")}`;

        await writeContract(
            "addPhysician",
            [accounts[2], physicianPublicKeyHex],
            accounts[0]
        );
        const isPhysicianAuthorized = await readContract(
            "authorizedPhysiciansByHospital",
            [accounts[2]]
        );
        expect(isPhysicianAuthorized).to.equal(true);

        const agents = await readContract(
            "getAgents",
            [accounts[1]],
            accounts[2]
        );
        expect(agents).to.be.lengthOf(5);
    });

    it("should fetch agents and have accurate data", async () => {
        const physicianPublicKeyHex = `0x${Buffer.from(
            physicianKeyPair.publicKey
        ).toString("hex")}`;

        const patientPublicKeyHex = `0x${Buffer.from(
            patientKeyPair.publicKey
        ).toString("hex")}`;

        const agents = await readContract(
            "getAgents",
            [accounts[1]],
            accounts[2]
        );

        for (const agent of agents) {
            if (agent.role == 0) {
                expect(agent.publicKey).to.equal(hospitalPublicKeyHex);
            }
            if (agent.role == 1) {
                expect(agent.publicKey).to.equal(patientPublicKeyHex);
            }
            if (agent.role == 2) {
                expect(agent.publicKey).to.equal(physicianPublicKeyHex);
            }
            if (agent.role == 3) {
                expect([oracle1PublicKeyHex, oracle2PublicKeyHex]).to.include(
                    agent.publicKey
                );
            }
        }
    });

    it("should throw error if physician requests agent data for invalid patient address", async () => {
        await expect(
            readContract("getAgents", [accounts[9]], accounts[2])
        ).to.be.rejectedWith("Error: Invalid patient address");

        await expect(
            readContract("getAgents", [accounts[0]], accounts[2])
        ).to.be.rejectedWith("Error: Invalid patient address");

        await expect(
            readContract("getAgents", [accounts[2]], accounts[2])
        ).to.be.rejectedWith("Error: Invalid patient address");
    });

    it("should update an oracle public key", async () => {
        const newOraclePublicKey = `0x${Buffer.from(
            generateKeypair().publicKey
        ).toString("hex")}`;

        await writeContract(
            "updateOraclePubKey",
            [0, newOraclePublicKey],
            accounts[0]
        );
        const oracle = await readContract("getOracle", [0]);
        expect(oracle.publicKey).to.equal(newOraclePublicKey);
    });

    it("should NOT update an oracle public key (unauthorized)", async () => {
        const newOraclePublicKey = `0x${Buffer.from(
            generateKeypair().publicKey
        ).toString("hex")}`;

        await expect(
            writeContract(
                "updateOraclePubKey",
                [1, newOraclePublicKey],
                accounts[2]
            )
        ).to.be.rejectedWith("Not authorized: Caller is not the hospital");
        const oracle = await readContract("getOracle", [1]);
        expect(oracle.publicKey).to.not.equal(newOraclePublicKey);
    });

    // CLAUDE
    it("should add a record for a patient", async () => {
        // Create a mock record
        const mockRecord = createMockRecord();

        // Add the record as an authorized physician
        const hash = await testClient.writeContract({
            address: nexaEHRAddress,
            abi: NexaEHRAbi,
            functionName: "addRecord",
            args: [accounts[1], mockRecord],
            account: accounts[2],
        });

        // Get transaction receipt to check gas used
        const receipt = await testClient.waitForTransactionReceipt({ hash });
        console.log(`Gas used for adding a record: ${receipt.gasUsed}`);

        // Optional: Assert gas usage is within reasonable limits
        // expect(receipt.gasUsed).to.be.lessThan(500000); // Adjust limit as needed

        // Verify record count increased
        const recordCount = await readContract(
            "getRecordCount",
            [accounts[1]],
            accounts[2]
        );
        expect(recordCount).to.equal(1);

        // Verify we can retrieve the record
        const retrievedRecord = await readContract(
            "getLatestRecord",
            [accounts[1]],
            accounts[2]
        );

        expect(retrievedRecord.contentId).to.equal(mockRecord.contentId);
        expect(retrievedRecord.nonce).to.equal(mockRecord.nonce);
        expect(retrievedRecord.authTag).to.equal(mockRecord.authTag);
    });

    it("should NOT add a record for a patient (unauthorized physician)", async () => {
        const mockRecord = createMockRecord();

        // Revoke physician authorization
        await writeContract("revokePhysician", [accounts[2]], accounts[0]);

        // Try to add record with revoked physician
        await expect(
            writeContract("addRecord", [accounts[1], mockRecord], accounts[2])
        ).to.be.rejectedWith(
            "Not authorized: Physician not authorized by hospital"
        );

        // Restore physician authorization for other tests
        const physicianPublicKeyHex = `0x${Buffer.from(
            physicianKeyPair.publicKey
        ).toString("hex")}`;
        await writeContract(
            "addPhysician",
            [accounts[2], physicianPublicKeyHex],
            accounts[0]
        );
    });

    it("should NOT add a record for non-registered patient", async () => {
        const mockRecord = createMockRecord();

        // Try to add record for non-registered patient
        await expect(
            writeContract("addRecord", [accounts[5], mockRecord], accounts[2])
        ).to.be.rejectedWith("Error: Not a registered patient in hospital");
    });

    it("should allow patient to access their own records", async () => {
        // Add another record
        const mockRecord = createMockRecord();
        await writeContract(
            "addRecord",
            [accounts[1], mockRecord],
            accounts[2]
        );

        // Patient should be able to retrieve their own record
        const retrievedRecord = await readContract(
            "getLatestRecord",
            [accounts[1]],
            accounts[1]
        );

        expect(retrievedRecord.contentId).to.equal(mockRecord.contentId);
    });

    it("should get record by index", async () => {
        // Add a third record
        const mockRecord = createMockRecord();
        await writeContract(
            "addRecord",
            [accounts[1], mockRecord],
            accounts[2]
        );

        // Get record count
        const recordCount = await readContract(
            "getRecordCount",
            [accounts[1]],
            accounts[2]
        );
        expect(recordCount).to.equal(3);

        // Get second record (index 1)
        const retrievedRecord = await readContract(
            "getRecord",
            [accounts[1], 1],
            accounts[2]
        );

        // Verify it exists
        expect(retrievedRecord.contentId).not.to.be.undefined;
    });

    it("should NOT get record with invalid index", async () => {
        await expect(
            readContract("getRecord", [accounts[1], 99], accounts[2])
        ).to.be.rejectedWith("Error: Invalid record number");
    });

    it("should request oracle assistance", async () => {
        // Create a request ID
        const requestId = `0x${bytesToHex(randomBytes(16))}`;

        // Get latest record
        const latestRecord = await readContract(
            "getLatestRecord",
            [accounts[1]],
            accounts[2]
        );

        // Watch for emitted event
        const watchPromise = new Promise((resolve) => {
            testClient.watchContractEvent({
                address: nexaEHRAddress,
                abi: NexaEHRAbi,
                eventName: "KeySharesRequested",
                onLogs: (logs: any) => {
                    resolve(logs);
                },
            });
        });

        // Request oracle assistance
        await writeContract(
            "requestOracleAssistance",
            [requestId, latestRecord],
            accounts[2]
        );

        // Wait for event to be emitted
        const logs: any = await watchPromise;
        expect(logs.length).to.be.greaterThan(0);

        // Verify event data
        const eventData = logs[0];
        expect(eventData.args.requestId).to.equal(requestId);

        // Physician's public key should be in the event
        const physicianPublicKeyHex = `0x${Buffer.from(
            physicianKeyPair.publicKey
        ).toString("hex")}`;
        expect(eventData.args.requesterPublicKey).to.equal(
            physicianPublicKeyHex
        );

        // Should include 2 oracle shares
        expect(eventData.args.encryptedKeyShares.length).to.equal(2);
    });

    it("should allow oracle to submit re-encrypted shares", async () => {
        // Setup oracle account with private key
        const oracleAccount = accounts[3];
        const requestId = `0x${bytesToHex(randomBytes(16))}`;

        // Create mock re-encrypted shares
        const reEncryptedShares = [
            createEncryptedShare(3, null),
            createEncryptedShare(3, null),
        ];

        // Register the oracle address
        const oraclePublicKeyHex = oracle1PublicKeyHex;
        await writeContract(
            "addPhysician", // Using this just to register an address
            [oracleAccount, oraclePublicKeyHex],
            accounts[0]
        );

        // Update the oracle public key to match the account
        await writeContract(
            "updateOraclePubKey",
            [0, oraclePublicKeyHex],
            accounts[0]
        );

        // Watch for emitted event
        const watchPromise = new Promise((resolve) => {
            testClient.watchContractEvent({
                address: nexaEHRAddress,
                abi: NexaEHRAbi,
                eventName: "KeySharesResponse",
                onLogs: (logs: any) => {
                    resolve(logs);
                },
            });
        });

        // Submit re-encrypted shares
        await writeContract(
            "submitReEncryptedShare",
            [requestId, true, reEncryptedShares],
            oracleAccount
        );

        // Wait for event to be emitted
        const logs: any = await watchPromise;
        expect(logs.length).to.be.greaterThan(0);

        // Verify event data
        const eventData = logs[0];
        expect(eventData.args.requestId).to.equal(requestId);
        expect(eventData.args.isSuccess).to.equal(true);
        expect(eventData.args.reEncryptedKeyShares.length).to.equal(2);
    });

    it("should NOT allow unauthorized address to submit re-encrypted shares", async () => {
        const requestId = `0x${bytesToHex(randomBytes(16))}`;
        const reEncryptedShares = [
            createEncryptedShare(3, null),
            createEncryptedShare(3, null),
        ];

        // Try to submit as non-oracle
        await expect(
            writeContract(
                "submitReEncryptedShare",
                [requestId, true, reEncryptedShares],
                accounts[4]
            )
        ).to.be.rejectedWith("Not authorized: Must be a registered oracle");
    });

    it("should allow patient to request oracle assistance", async () => {
        // Create a request ID
        const requestId = `0x${bytesToHex(randomBytes(16))}`;

        // Get latest record
        const latestRecord = await readContract(
            "getLatestRecord",
            [accounts[1]],
            accounts[1]
        );

        // Watch for emitted event
        const watchPromise = new Promise((resolve) => {
            testClient.watchContractEvent({
                address: nexaEHRAddress,
                abi: NexaEHRAbi,
                eventName: "KeySharesRequested",
                onLogs: (logs: any) => {
                    resolve(logs);
                },
            });
        });

        // Request oracle assistance as patient
        await writeContract(
            "requestOracleAssistance",
            [requestId, latestRecord],
            accounts[1]
        );

        // Wait for event to be emitted
        const logs: any = await watchPromise;
        expect(logs.length).to.be.greaterThan(0);

        // Verify event data
        const eventData = logs[0];
        expect(eventData.args.requestId).to.equal(requestId);

        // Patient's public key should be in the event
        const patientPublicKeyHex = `0x${Buffer.from(
            patientKeyPair.publicKey
        ).toString("hex")}`;
        expect(eventData.args.requesterPublicKey).to.equal(patientPublicKeyHex);
    });

    it("should NOT allow non-patient/non-physician to request oracle assistance", async () => {
        const requestId = `0x${bytesToHex(randomBytes(16))}`;
        const latestRecord = await readContract(
            "getLatestRecord",
            [accounts[1]],
            accounts[1]
        );

        // Try to request as non-patient/non-physician
        await expect(
            writeContract(
                "requestOracleAssistance",
                [requestId, latestRecord],
                accounts[4]
            )
        ).to.be.rejectedWith("Not Authorized: Not a registered agent");
    });
});
