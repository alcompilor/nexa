// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "./IEHRSystem.sol";

/// @title Role-Based Access Control Base Contract
/// @notice Provides foundational role checking and validation functionality
abstract contract RoleBase is IEHRSystem {
    /// @notice Current hospital administrator address
    address internal hospital;

    /// @notice Array of 2 oracle agents
    Agent[2] internal oracles;

    /// @notice Mapping of addresses to agent profiles
    mapping(address => Agent) internal addressToAgent;

    /// @notice Mapping of physician authorization status
    mapping(address => bool) internal authorizedPhysiciansByHospital;

    /// @dev Restrict to active registered agents
    modifier onlyActiveAgent() {
        require(
            addressToAgent[msg.sender].isActive,
            "Not Authorized: Not a registered agent"
        );
        _;
    }

    /// @dev Restrict to hospital-authorized physicians
    modifier onlyAuthorizedPhysician() {
        require(
            authorizedPhysiciansByHospital[msg.sender],
            "Not authorized: Physician not authorized by hospital"
        );
        _;
    }

    /// @dev Restrict to hospital admin only
    modifier onlyHospital() {
        require(
            isRole(Role.HOSPITAL) && msg.sender == hospital,
            "Not authorized: Caller is not the hospital"
        );
        _;
    }

    /// @dev Restrict to patient role only
    modifier onlyPatient() {
        require(isRole(Role.PATIENT), "Not authorized: Must be a patient");
        _;
    }

    /// @dev Restrict to physician role only
    modifier onlyPhysician() {
        require(isRole(Role.PHYSICIAN), "Not authorized: Must be a physician");
        _;
    }

    /// @dev Restrict to either authorized physician or the patient themselves
    modifier onlyAuthorizedPhysicianOrPatient(address _patientAddress) {
        require(
            authorizedPhysiciansByHospital[msg.sender] ||
                msg.sender == _patientAddress,
            "Not authorized: must be a trusted physician or the patient"
        );
        _;
    }

    /// @dev Validate ECDH public key format
    modifier validatePublicKey(bytes32 _publicKey) {
        require(_publicKey != 0, "Error: Invalid EDCH public key");
        _;
    }

    /// @notice Check if caller has specific role
    /// @param _role Role to check against
    /// @return True if caller has specified role
    function isRole(Role _role) internal view returns (bool) {
        return addressToAgent[msg.sender].role == _role;
    }
}
