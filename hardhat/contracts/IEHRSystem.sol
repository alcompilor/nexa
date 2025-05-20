// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @title Interface for EHR System Components
/// @notice Defines core data structures, roles and events for the Nexa EHR system
interface IEHRSystem {
    /// @notice System roles enumeration
    enum Role {
        HOSPITAL, // 0 - Hospital administrator
        PATIENT, // 1 - Patient user
        PHYSICIAN, // 2 - Medical practitioner
        ORACLE // 3 - Decentralized validator
    }

    /// @notice Agent identity structure
    /// @dev Stores role, activation status and public key for system participants
    struct Agent {
        Role role; // Participant's system role
        bool isActive; // Activation status
        bytes32 publicKey; // X25519 public key for ECDH operations
    }

    /// @notice Encrypted key share structure
    /// @dev Contains all components needed for secure share transmission
    struct EncryptedShare {
        Role role; // Recipient role
        bytes32 encryptedKeyShare; // ChaCha20-encrypted secret share
        bytes32 ephemeralPublicKey; // ECDH ephemeral public key
        bytes12 nonce; // Encryption nonce
        bytes16 authTag; // Poly1305 authentication tag
    }

    /// @notice EHR Record structure
    /// @dev Contains storage metadata and encryption components
    struct Record {
        bytes contentId; // Decentralized storage CID (Filecoin/IPFS)
        EncryptedShare[5] encryptedKeyShares; // 5 encrypted key shares
        bytes12 nonce; // ChaCha20 nonce for record encryption
        bytes16 authTag; // Poly1305 tag for record integrity
    }

    /// @notice Emitted when new patient registers
    event PatientAdded(address patient);

    /// @notice Emitted when new physician is added
    event PhysicianAdded(address physician);

    /// @notice Emitted when hospital admin changes
    event HospitalUpdated(address newHospital);

    /// @notice Emitted when oracle assistance is requested
    event KeySharesRequested(
        bytes16 indexed requestId,
        bytes32 indexed requesterPublicKey,
        EncryptedShare[2] encryptedKeyShares
    );

    /// @notice Emitted when oracles respond to share requests
    event KeySharesResponse(
        bytes16 indexed requestId,
        EncryptedShare[1] reEncryptedKeyShare,
        bool isSuccess
    );
}
