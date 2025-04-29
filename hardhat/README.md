# Nexa EHR System - Smart Contracts Documentation

## Overview
Nexa is a blockchain-based Electronic Health Record (EHR) system designed to balance security, scalability, and decentralization. Built on the Avalanche blockchain and integrated with decentralized storage (e.g., Filecoin), it employs **threshold cryptography** (ChaCha20 + Shamir's Secret Sharing) to secure patient data. This system ensures that no single entity can decrypt records, requiring collaboration between multiple authorized parties. The smart contracts manage role-based access control (RBAC), EHR storage metadata, and cryptographic key distribution.

---

## Key Features
- **Role-Based Access Control (RBAC):** Patients, physicians, hospitals, and oracles have distinct permissions.
- **Threshold Cryptography:** EHRs are encrypted with a symmetric key split into 5 shares, requiring ≥3 shares for decryption.
- **Decentralized Storage:** EHR content is stored off-chain (e.g., Filecoin/IPFS), with on-chain metadata for integrity.
- **Oracle Services:** Neutral validators assist in secure key share exchanges.
- **Immutable Audit Trail:** All access and modifications are recorded on the blockchain.

---

## Contracts Overview
### 1. **`IEHRSystem.sol`** (Interface)
- Defines enums, structs, and events used across contracts.
  - **Roles:** `HOSPITAL`, `PATIENT`, `PHYSICIAN`, `ORACLE`.
  - **Structs:** 
    - `Agent`: Stores role, status, and public key (ECDH X25519).
    - `EncryptedShare`: Contains encrypted key shares, nonces, and authentication tags.
    - `Record`: Links decentralized storage content IDs (CIDs) to encrypted key shares.
  - **Events:** Track role assignments, key share requests, and responses.

### 2. **`RoleBase.sol`** (Abstract Contract)
- Base contract for role management.
- **Modifiers:** Enforce permissions (e.g., `onlyHospital`, `onlyPatient`).
- **Functions:** Check roles (`isRole`) and validate public keys.

### 3. **`RoleManager.sol`**
- Manages role assignments and agent lifecycle:
  - **Hospital:** Initializes the system, updates oracle keys.
  - **Patients:** Self-register with public keys.
  - **Physicians:** Added/revoked by the hospital.
  - **Oracles:** Pre-configured neutral validators with updatable keys.

### 4. **`EHRManager.sol`**
- Handles EHR lifecycle:
  - **Add Records:** Physicians link encrypted EHR metadata to patients.
  - **Oracle Assistance:** Requests/receives re-encrypted key shares for decryption.
  - **Access Controls:** Restricts record retrieval to authorized physicians or patients.

### 5. **`NexaEHR.sol`**
- Main contract inheriting `RoleManager` and `EHRManager`.
- Initializes the system with hospital and oracle keys.

---

## System Workflow
### 1. **Initialization**
1. **Hospital Deployment:**  
   - Deploys `NexaEHR` with its ECDH public key and two oracle keys.
   - Registers oracles and physicians.

2. **Patient/Physician Onboarding:**  
   - Patients self-register via `addPatient()` with their public key.
   - Physicians are added by the hospital via `addPhysician()`.

### 2. **EHR Creation**
1. **Physician Actions:**  
   - Encrypts EHR using ChaCha20.
   - Splits the key into 5 shares (patient, hospital, physician, 2 oracles).
   - Stores encrypted EHR on decentralized storage (e.g., Filecoin) and submits metadata (CID + encrypted shares) via `addRecord()`.

### 3. **EHR Access**
1. **Patient/Physician Requests:**  
   - Call `requestOracleAssistance()` to fetch oracle-encrypted shares.
   - Oracles re-encrypt shares with the requester’s public key and emit `KeySharesResponse`.
   - Requester decrypts shares, reconstructs the ChaCha20 key, and retrieves EHR from storage.

### 4. **Revocation**
- **Physicians:** Revoked via `revokePhysician()`, blocking future access.
- **Patients:** Deactivated via `revokePatient()`.

---

## Prerequisites
1. **Blockchain Network:** Avalanche Fuji Testnet/C-Chain (recommended).
2. **Tools:**  
   - Hardhat/Remix IDE for deployment.
   - ethers.js/web3.js/viem for frontend integration.
   - MetaMask/Web3 wallet.
3. **Storage:** Filecoin/IPFS node for off-chain EHR storage.

Run `npm install` to install all required packages.

---

## Testing
1. **Local Simulation:**  
   - Use Hardhat Network or Remix VM to deploy contracts.
   - Generate synthetic EHRs (e.g., using Synthea) for testing.
   - Validate RBAC flows (e.g., physician revocation).

2. **Testnet Deployment:**  
   - Deploy on Avalanche Fuji Testnet.
   - Test end-to-end workflows:
     - Patient registration.
     - EHR creation/retrieval.
     - Oracle interactions.

3. **Example Test Cases:**  
   - Ensure revoked physicians cannot access records.
   - Verify threshold decryption requires ≥3 shares.
   - Validate metadata integrity (SHA-256 hashes).

You can run a comprehensive unit test suite that covers the contract's most critical components using the following command:
`npm run test:with-node`

---

## Security Features
- **Threshold Cryptography:** No single entity holds full decryption keys.
- **Immutable Permissions:** RBAC enforced via smart contracts.
- **Decentralized Storage:** Tamper-proof EHR storage with content addressing.
- **Oracle Trust Model:** Shares distributed to neutral third parties.

---

## Future Enhancements
1. **Interoperability:** FHIR/HL7 compliance for EHR formatting.
2. **Key Rotation:** Automated re-encryption for compromised keys.
3. **Gas Optimization:** Reduce transaction costs for high-throughput scenarios.
4. **Real-World Pilots:** Integrate with healthcare providers for usability testing.

---

## License
MIT License. See `SPDX-License-Identifier` in contract headers.