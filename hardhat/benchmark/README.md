# NexaEHR Benchmarking Suite

A comprehensive benchmarking tool for evaluating the performance of the NexaEHR blockchain-based Electronic Health Records system on the Avalanche Fuji testnet.

## Overview

The NexaEHR Benchmarking Suite measures performance metrics for various operations in a decentralized healthcare data management system, including:

- User registration and revocation (patients and physicians)
- EHR record storage and retrieval (both on-chain and IPFS)
- Oracle-assisted operations for privacy-preserving data sharing

Results are collected and analyzed to provide insights into system performance and scalability.

## Requirements

- Node.js v21 or higher
- Avalanche Fuji testnet accounts with at least 4.0 AVAX in each for gas (consider MetaMask)
- Filebase account for IPFS storage
- Local dataset of EHR records for benchmarking

Dataset that has been used for benchmarking can be found on Kaggle:
https://www.kaggle.com/datasets/alcompilor/synthetic-ehrs-for-benchmarking-system-perfomance

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/alcompilor/nexa.git
   cd nexa/hardhat
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the project root with the required environment variables (see below).

4. Create a `dataset` directory containing numbered JSON files (`1.json`, `2.json`, etc.) with sample EHR data.

## Environment Variables

The following environment variables must be set in a `.env` file:

### Account Private Keys

```
HOSPITAL_PRIVATE_KEY
PATIENT_PRIVATE_KEY
PHYSICIAN_PRIVATE_KEY
ORACLE1_PRIVATE_KEY
ORACLE2_PRIVATE_KEY
```

### Filebase IPFS Configuration

```
FILEBASE_ACCESS_KEY
FILEBASE_SECRET_KEY
FILEBASE_BUCKET
```

### Benchmark Parameters

```
RECORD_MANAGEMENT_ITERATIONS
ROLE_MANAGEMENT_ITERATIONS
```

### Network Configuration

```
AVALANCHE_TESTNET_RPC_URL
```

## Environment Variables Reference

### Account Private Keys

| Variable | Description |
|----------|-------------|
| `HOSPITAL_PRIVATE_KEY` | Private key for the hospital/healthcare provider account. This account is used to deploy the NexaEHR contract and manage physician registrations. Must be a valid Ethereum private key (without 0x prefix). Should have sufficient AVAX funds for contract deployment and transactions. |
| `PATIENT_PRIVATE_KEY` | Private key for the patient/data subject account. This account is used to register as a patient and manage patient-specific operations. Must be a valid Ethereum private key (without 0x prefix). Should have sufficient AVAX funds for transaction fees. |
| `PHYSICIAN_PRIVATE_KEY` | Private key for the physician/healthcare professional account. This account is used for adding EHR records and performing physician-specific operations. Must be a valid Ethereum private key (without 0x prefix). Should have sufficient AVAX funds for transaction fees. |
| `ORACLE1_PRIVATE_KEY` | Private key for the first trusted oracle account. This oracle assists with key management and privacy-preserving data sharing. Must be a valid Ethereum private key (without 0x prefix). Should have sufficient AVAX funds for transaction fees. |
| `ORACLE2_PRIVATE_KEY` | Private key for the second trusted oracle account. Provides redundancy and security for oracle operations in the system. Must be a valid Ethereum private key (without 0x prefix). Should have sufficient AVAX funds for transaction fees. |

### Filebase IPFS Configuration

| Variable | Description |
|----------|-------------|
| `FILEBASE_ACCESS_KEY` | Access key for Filebase S3-compatible IPFS storage. Used to authenticate with the Filebase API for storing encrypted EHR data. Can be obtained from the Filebase user dashboard after creating an account. |
| `FILEBASE_SECRET_KEY` | Secret key for Filebase S3-compatible IPFS storage. Used in conjunction with the access key to authenticate API requests. Should be kept secure and never committed to version control. |
| `FILEBASE_BUCKET` | Name of the Filebase bucket for storing EHR records. The bucket must be created in the Filebase dashboard before running tests. Should be configured with appropriate permissions for the access/secret keys. |

### Benchmark Parameters

| Variable | Description |
|----------|-------------|
| `RECORD_MANAGEMENT_ITERATIONS` | Number of EHR record operations to benchmark (example: 1000). Controls how many records will be created, stored, and retrieved during testing. Higher values provide more accurate benchmarks but increase test duration. This must align with the number of records in your dataset. |
| `ROLE_MANAGEMENT_ITERATIONS` | Number of role registration operations to benchmark (example: 100). Controls how many times patient and physician roles will be registered and revoked. Higher values provide more accurate benchmarks but increase test duration. |

### Network Configuration

| Variable | Description |
|----------|-------------|
| `AVALANCHE_TESTNET_RPC_URL` | RPC endpoint URL for the Avalanche Fuji testnet (example: "https://api.avax-test.network/ext/bc/C/rpc"). Used to connect to the Avalanche C-Chain for contract deployment and transactions. Can be customized to use other RPC providers or local nodes if needed. |

## Usage

Run the benchmarking suite:

```
npx hardhat test ./benchmark/benchmark.ts
```

Results will be saved to a time-stamped JSON file in the project root directory and summary statistics will be displayed in the console.

## Security Notes

- Never commit your `.env` file or private keys to version control
- Use testnet accounts only, never production accounts with real assets
- Ensure your Filebase bucket permissions are properly configured

## License

[MIT License](LICENSE)