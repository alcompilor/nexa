// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "./RoleManager.sol";
import "./EHRManager.sol";

/// @title Main Nexa EHR Contract
/// @notice Inherits all system functionality from RoleManager and EHRManager
contract NexaEHR is RoleManager, EHRManager {
    /// @notice Initialize EHR system
    /// @param hospitalPublicKey Hospital admin's public key
    /// @param oraclePublicKey1 First oracle public key
    /// @param oraclePublicKey2 Second oracle public key
    constructor(
        bytes32 hospitalPublicKey,
        bytes32 oraclePublicKey1,
        bytes32 oraclePublicKey2
    ) RoleManager(hospitalPublicKey, oraclePublicKey1, oraclePublicKey2) {}
}
