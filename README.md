# Nexa: Secure, Scalable and Decentralized EHR Management

> Blockchain-based Electronic Health Record management using Threshold Cryptography and public blockchains (Avalanche).

This repository contains the full prototype implementation accompanying the paper:

**"Nexa: Enabling Secure, Scalable and Decentralized Management of Electronic Health Records Using Threshold Cryptography and Public Blockchains"**  
Ahmed Abbasi, Mohamed N. Humeidi, Qinghua Wang — IEEE Access

DOI: 10.1109/ACCESS.2026.3677499

---

## Table of Contents

- [Nexa: Secure, Scalable and Decentralized EHR Management](#nexa-secure-scalable-and-decentralized-ehr-management)
  - [Table of Contents](#table-of-contents)
  - [Architecture Overview](#architecture-overview)
  - [Repository Structure](#repository-structure)
  - [Requirements](#requirements)
    - [Hardware](#hardware)
    - [Software](#software)
    - [External Services](#external-services)
      - [1. Avalanche Fuji Testnet RPC](#1-avalanche-fuji-testnet-rpc)
      - [2. Filebase (IPFS Gateway)](#2-filebase-ipfs-gateway)
      - [3. MetaMask (or Compatible Wallet)](#3-metamask-or-compatible-wallet)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
    - [Hardhat (`hardhat/.env`)](#hardhat-hardhatenv)
    - [Oracle 1 (`oracles/oracle1/.env`)](#oracle-1-oraclesoracle1env)
    - [Oracle 2 (`oracles/oracle2/.env`)](#oracle-2-oraclesoracle2env)
    - [Client (`client/.env`)](#client-clientenv)
    - [Benchmarks (`benchmarks/.env`)](#benchmarks-benchmarksenv)
  - [Deployment](#deployment)
    - [1. Smart Contracts (Hardhat)](#1-smart-contracts-hardhat)
      - [Step 1 — Obtain oracle public keys](#step-1--obtain-oracle-public-keys)
      - [Step 2 — Deploy the contract](#step-2--deploy-the-contract)
      - [Step 3 — Verify deployment (optional)](#step-3--verify-deployment-optional)
    - [2. Oracle Services](#2-oracle-services)
      - [Build and start Oracle 1:](#build-and-start-oracle-1)
      - [Build and start Oracle 2:](#build-and-start-oracle-2)
      - [Endpoint configuration note](#endpoint-configuration-note)
    - [3. Client (Frontend)](#3-client-frontend)
    - [4. Benchmarks](#4-benchmarks)
  - [Running the System](#running-the-system)
  - [Benchmark Results](#benchmark-results)
    - [Cryptographic Operations (local)](#cryptographic-operations-local)
    - [Smart Contract Operations (Avalanche Fuji Testnet)](#smart-contract-operations-avalanche-fuji-testnet)
  - [License](#license)

---

## Architecture Overview

Nexa consists of four components:

```
┌─────────────────────────────────────────────────────────┐
│  Participants Layer (client/)                           │
│  React + Vite frontend — Hospital, Patient, Physician   │
└────────────────────────┬────────────────────────────────┘
                         │ JSON-RPC (viem)
┌────────────────────────▼────────────────────────────────┐
│  Blockchain Layer (hardhat/)                            │
│  NexaEHR Solidity smart contract on Avalanche Fuji      │
│  — RBAC, EHR metadata, key share events                 │
└──────┬──────────────────────────────────────┬───────────┘
       │ KeySharesRequested event              │ IPFS CID
┌──────▼──────────────┐             ┌──────────▼──────────┐
│  Oracle Services    │             │  Storage Layer       │
│  oracles/oracle1/   │             │  IPFS via Filebase   │
│  oracles/oracle2/   │             │  (encrypted EHRs)    │
│  X25519 + ChaCha20  │             └─────────────────────┘
└─────────────────────┘
```

**Key cryptographic flow:**
1. EHR is encrypted with ChaCha20-Poly1305 using a random symmetric key `K`
2. `K` is split into 5 Shamir shares (threshold k ≥ 3) — one each for Hospital, Patient, Physician, Oracle 1, Oracle 2
3. Each share is encrypted via X25519 ECDH + ChaCha20-Poly1305 for its recipient
4. CID (IPFS) and all encrypted shares are registered on-chain via `addRecord()`
5. On access, the user decrypts their own share locally, then calls `requestOracleAssistance()` to trigger oracle re-encryption of the two oracle shares
6. Oracles listen for `KeySharesRequested` events, decrypt and re-encrypt their shares for the requester, and submit via `submitReEncryptedShare()`
7. The user reconstructs `K` from 3 shares and decrypts the EHR from IPFS

---

## Repository Structure

```
.
├── benchmarks/          # TypeScript benchmark scripts (crypto + contract ops)
├── client/              # React + Vite proof-of-concept frontend
│   ├── src/
│   │   ├── components/  # UI components (AddRecord, AccessRecord, etc.)
│   │   ├── lib/         # encrypt.ts, decrypt.ts, ipfsClient.ts, viemHelpers.ts
│   │   ├── pages/       # HospitalPanel, PatientPortal, PhysicianPortal
│   │   └── stores/      # Zustand state (patient private key store)
│   └── scripts/
│       └── generate-keypairs.ts  # Helper to generate X25519 keypairs
├── hardhat/             # Solidity contracts + Hardhat config
│   ├── contracts/
│   │   ├── IEHRSystem.sol   # Interfaces, structs, events
│   │   ├── RoleBase.sol     # RBAC modifiers and storage
│   │   ├── RoleManager.sol  # Patient/physician/hospital management
│   │   ├── EHRManager.sol   # Record creation, retrieval, oracle requests
│   │   └── NexaEHR.sol      # Root contract (inherits all)
│   ├── scripts/
│   │   └── deploy.ts        # Deployment script
│   └── test/
│       └── NexaEHR.test.ts  # Full test suite (viem + Hardhat)
└── oracles/
    ├── oracle1/         # Oracle 1 service (Express + TypeScript)
    │   └── src/index.ts
    └── oracle2/         # Oracle 2 service (identical, separate keys)
        └── src/index.ts
```

---

## Requirements

### Hardware

The prototype was developed and evaluated on a 64-bit machine with at least **8 GB RAM**. The original paper benchmarks were conducted on a machine with 32 GB RAM. For development and testing purposes, 8 GB is sufficient.

### Software

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 20.x LTS | Required by all components |
| pnpm | ≥ 9.x | Package manager used throughout (`npm i -g pnpm`) |
| TypeScript | ≥ 5.7 | Installed per-package via `devDependencies` |
| Git | Any recent | For cloning |

> **Note:** The oracle services and benchmarks are compiled with `tsc` and run with `node dist/index.js`. The client uses Vite's dev server or build pipeline. No global TypeScript installation is required beyond what each package installs locally.

### External Services

Three external services must be provisioned before deployment:

#### 1. Avalanche Fuji Testnet RPC
The prototype targets the **Avalanche Fuji C-Chain testnet**.

- **Public RPC endpoint:** `https://api.avax-test.network/ext/bc/C/rpc`
- **Chain ID:** `43113`
- **Testnet AVAX faucet:** https://faucet.avax.network (required for gas — request at least 1 AVAX per deployer/oracle wallet)
- **Block explorer:** https://testnet.snowtrace.io

Alternatively, a private RPC endpoint from [Infura](https://infura.io), [Alchemy](https://www.alchemy.com), or [QuickNode](https://www.quicknode.com) can be used for higher reliability. Set the resulting URL as `RPC_URL` in your `.env` files.

#### 2. Filebase (IPFS Gateway)
Nexa stores encrypted EHRs on IPFS via [Filebase](https://filebase.com), which provides an S3-compatible API backed by IPFS.

1. Create a free account at https://filebase.com
2. Create a **bucket** (e.g., `nexa-ehrs`) with IPFS storage enabled
3. Generate an **Access Key** and **Secret Key** from the Filebase console
4. Note your bucket name — the client uses these credentials to call the S3-compatible API

The client's `ipfsClient.ts` uses `@aws-sdk/client-s3` pointed at `https://s3.filebase.com`.

#### 3. MetaMask (or Compatible Wallet)
The frontend is designed for use with a browser wallet. Each participant role (Hospital, Patient, Physician) requires a funded Fuji testnet wallet.

- Install MetaMask: https://metamask.io
- Add Avalanche Fuji network manually:
  - **Network Name:** Avalanche Fuji Testnet
  - **RPC URL:** `https://api.avax-test.network/ext/bc/C/rpc`
  - **Chain ID:** `43113`
  - **Currency Symbol:** AVAX
  - **Block Explorer:** `https://testnet.snowtrace.io`

---

## Installation

Clone the repository and install dependencies for each component:

```bash
git clone https://github.com/alcompilor/nexa.git
cd nexa
```

**Smart contracts:**
```bash
cd hardhat
pnpm install
```

**Oracle 1:**
```bash
cd oracles/oracle1
pnpm install
```

**Oracle 2:**
```bash
cd oracles/oracle2
pnpm install
```

**Client:**
```bash
cd client
pnpm install
```

**Benchmarks:**
```bash
cd benchmarks
pnpm install
```

---

## Environment Configuration

Each component that interacts with the blockchain or IPFS requires a `.env` file. Templates are described below.

### Hardhat (`hardhat/.env`)

```env
# Private key of the deployer wallet (Hospital admin). No 0x prefix.
PRIVATE_KEY=your_wallet_private_key_here

# Avalanche Fuji RPC URL
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
```

> The deployer account is automatically assigned the **Hospital** role in the constructor. Fund it with testnet AVAX before deploying.

### Oracle 1 (`oracles/oracle1/.env`)

```env
# Private key of Oracle 1's blockchain wallet (used to sign submitReEncryptedShare txs). No 0x prefix.
ORACLE_CHAIN_PRIVATE_KEY=your_oracle1_wallet_private_key_here

# Deployed NexaEHR contract address (set after running deploy.ts). With 0x prefix.
CONTRACT_ADDRESS=0xYourDeployedContractAddressHere

# Avalanche Fuji RPC URL
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc

# X25519 cryptographic private key for share decryption/re-encryption (hex, no 0x prefix).
# If omitted, a new key is auto-generated on first run and appended to this file.
# WARNING: Once registered on-chain, this key is permanent. Back it up securely.
# Losing it makes all oracle-held shares unrecoverable.
ORACLE_PRIVATE_KEY=
```

> After the first run, the oracle will auto-generate `ORACLE_PRIVATE_KEY` and append it to the `.env` file. The corresponding **X25519 public key** is printed to stdout — copy it for use during contract deployment.

### Oracle 2 (`oracles/oracle2/.env`)

Identical structure to Oracle 1, but with a **separate wallet** and a **separate X25519 keypair**:

```env
ORACLE_CHAIN_PRIVATE_KEY=your_oracle2_wallet_private_key_here
CONTRACT_ADDRESS=0xYourDeployedContractAddressHere
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
ORACLE_PRIVATE_KEY=
```

### Client (`client/.env`)

```env
# Deployed NexaEHR contract address. With 0x prefix.
VITE_CONTRACT_ADDRESS=0xYourDeployedContractAddressHere

# Avalanche Fuji RPC URL
VITE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc

# Filebase S3-compatible credentials
VITE_FILEBASE_ACCESS_KEY=your_filebase_access_key
VITE_FILEBASE_SECRET_KEY=your_filebase_secret_key
VITE_FILEBASE_BUCKET=your_bucket_name
```

### Benchmarks (`benchmarks/.env`)

```env
# Private key of a funded Fuji wallet used to send benchmark transactions. No 0x prefix.
PRIVATE_KEY=your_benchmark_wallet_private_key_here

# Deployed NexaEHR contract address. With 0x prefix.
CONTRACT_ADDRESS=0xYourDeployedContractAddressHere

# Avalanche Fuji RPC URL
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
```

---

## Deployment

### 1. Smart Contracts (Hardhat)

#### Step 1 — Obtain oracle public keys

Before deploying, you need the X25519 public keys for both oracles. The easiest approach is to start each oracle once without a contract address to trigger key generation:

```bash
# In oracles/oracle1 — will fail on missing CONTRACT_ADDRESS but will generate and print the key
cd oracles/oracle1
pnpm build
# Temporarily set a dummy CONTRACT_ADDRESS to get past the env check,
# or simply add ORACLE_PRIVATE_KEY manually after generating via:
node -e "
const { x25519 } = await import('@noble/curves/ed25519');
const priv = x25519.utils.randomPrivateKey();
const pub = x25519.getPublicKey(priv);
console.log('PRIVATE:', Buffer.from(priv).toString('hex'));
console.log('PUBLIC: 0x' + Buffer.from(pub).toString('hex'));
" --input-type=module
```

Repeat for oracle 2. Set the resulting `ORACLE_PRIVATE_KEY` in each oracle's `.env`. Note both **public keys** (with `0x` prefix) — they are passed as constructor arguments.

#### Step 2 — Deploy the contract

```bash
cd hardhat
pnpm hardhat run scripts/deploy.ts --network fuji
```

The deploy script will output the deployed contract address. Copy it into `CONTRACT_ADDRESS` in all `.env` files.

> **`hardhat/scripts/deploy.ts`** expects the following constructor arguments: `hospitalPublicKey`, `oraclePublicKey1`, `oraclePublicKey2`. Edit the script to pass in your oracle public keys before running.

Example snippet in `deploy.ts`:
```typescript
const contract = await hre.viem.deployContract("NexaEHR", [
  "0xYourHospitalPublicKey",
  "0xOracle1PublicKey",
  "0xOracle2PublicKey",
]);
console.log("NexaEHR deployed to:", contract.address);
```

#### Step 3 — Verify deployment (optional)

```bash
pnpm hardhat test --network fuji
```

Or run tests against the local Hardhat node:

```bash
pnpm hardhat node           # terminal 1
pnpm hardhat test           # terminal 2
```

---

### 2. Oracle Services

Each oracle is a long-running Express service that listens for `KeySharesRequested` events on-chain and responds by re-encrypting shares for the requester.

#### Build and start Oracle 1:
```bash
cd oracles/oracle1
pnpm build          # compiles TypeScript to dist/index.js
pnpm start          # runs dist/index.js
```

#### Build and start Oracle 2:
```bash
cd oracles/oracle2
pnpm build
pnpm start
```

On startup, each oracle prints its **X25519 public key** and the **contract address** it is monitoring:

```
Oracle is running and listening for events from contract:
0xYourDeployedContractAddress

Oracle's ECDH X25519 Public Key:
<64-char hex string>
```

**For development with hot-reload:**
```bash
pnpm dev    # uses ts-node-dev with --respawn
```

> **Important:** Oracle wallets (`ORACLE_CHAIN_PRIVATE_KEY`) must be funded with testnet AVAX to pay gas for `submitReEncryptedShare()` transactions (~30,000 gas units per call, < $0.01 at current rates).

#### Endpoint configuration note

The oracle services run an Express HTTP server on **port 3000** by default (oracle1) and should be configured to run on a different port for oracle2. Edit `src/index.ts` if you need to change the port:

```typescript
const port = 3000;  // Change to e.g. 3001 for oracle2
```

The HTTP server is a lightweight health-check surface. The core oracle logic is event-driven via `viem`'s `watchContractEvent` polling Avalanche Fuji over the configured `RPC_URL` — no inbound HTTP endpoints are required for the protocol to function.

---

### 3. Client (Frontend)

The client is a React + Vite proof-of-concept that demonstrates integration between the browser wallet (MetaMask), the smart contract, and IPFS.

**Development server:**
```bash
cd client
pnpm dev
```
Runs at `http://localhost:5173` by default.

**Production build:**
```bash
pnpm build          # outputs to client/dist/
pnpm preview        # serves the built output locally
```

**Generate participant X25519 keypairs (helper script):**
```bash
cd client
pnpm tsx scripts/generate-keypairs.ts
```
This prints X25519 public/private key pairs for use when registering patients and physicians.

---

### 4. Benchmarks

The benchmark suite measures cryptographic operations and smart contract latency against the Fuji testnet.

```bash
cd benchmarks

# Cryptography benchmark (local, no blockchain)
pnpm tsx benchmarks/cryptography/benchmark.ts

# Smart contract + IPFS benchmark (requires funded wallet + deployed contract)
pnpm tsx benchmarks/contracts-and-storage/benchmark.ts
```

Results are written to timestamped JSON files in `benchmarks/contracts-and-storage/` and `benchmarks/cryptography/`.

---

## Running the System

Full end-to-end flow once all components are deployed and configured:

```
Terminal 1 — Oracle 1:    cd oracles/oracle1 && pnpm start
Terminal 2 — Oracle 2:    cd oracles/oracle2 && pnpm start
Terminal 3 — Client:      cd client && pnpm dev
```

Interact via the browser at `http://localhost:5173` using MetaMask connected to Avalanche Fuji. The three UI panels correspond to Hospital, Physician, and Patient roles. Each role requires a separate MetaMask account funded with testnet AVAX.

---

## Benchmark Results

Benchmarks were conducted on the Avalanche Fuji Testnet. Full results are in `benchmarks/`.

### Cryptographic Operations (local)

| Operation | Mean | Min | Max |
|---|---|---|---|
| `encrypt()` | 24.56 ms | 8.93 ms | 405.61 ms |
| `decrypt()` | 19.16 ms | 4.56 ms | 379.38 ms |

Maximum latencies correspond to the largest synthetic EHR (~80 MB).

### Smart Contract Operations (Avalanche Fuji Testnet)

| Operation | Mean Latency | Mean Gas | Sample Size |
|---|---|---|---|
| `addPatient()` | 5,838 ms | 31,287 | 100 |
| `revokePatient()` | 5,734 ms | 26,772 | 100 |
| `addPhysician()` | 5,652 ms | 58,444 | 100 |
| `revokePhysician()` | 5,746 ms | 36,892 | 100 |
| `addRecord()` | 5,816 ms | 558,757 | 1000 |
| `getLatestRecord()` | 336 ms | — (read) | 1000 |
| `requestOracleAssistance()` | 5,546 ms | 47,282 | — |
| `submitReEncryptedShare()` | 5,450 ms | 30,581 | — |
| `ipfsStorage()` | 1,296 ms | — | 1000 |
| `ipfsRetrieve()` | 1,355 ms | — | 1000 |

Contract deployed at: [`0xd4843722480CAC372ecd4075371579C32e002Df9`](https://testnet.snowtrace.io/address/0xd4843722480CAC372ecd4075371579C32e002Df9) (Fuji Testnet)

Synthetic EHR dataset used for benchmarking: [Kaggle — synthetic-ehrs-for-benchmarking-system-perfomance](https://www.kaggle.com/datasets/alcompilor/synthetic-ehrs-for-benchmarking-system-perfomance)

---

## License

This project is licensed under [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). See the copyright receipt for details.