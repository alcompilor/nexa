// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "./RoleBase.sol";

/// @title Role Management Contract
/// @notice Handles agent lifecycle and permissions management
contract RoleManager is RoleBase {
    /// @notice Initialize system with hospital and oracle keys
    /// @param hospitalPublicKey Hospital's X25519 public key
    /// @param oraclePublicKey1 First oracle's public key
    /// @param oraclePublicKey2 Second oracle's public key
    constructor(
        bytes32 hospitalPublicKey,
        bytes32 oraclePublicKey1,
        bytes32 oraclePublicKey2
    ) {
        addressToAgent[msg.sender] = Agent({
            role: Role.HOSPITAL,
            isActive: true,
            publicKey: hospitalPublicKey
        });
        hospital = msg.sender;

        oracles[0] = Agent({
            role: Role.ORACLE,
            isActive: true,
            publicKey: oraclePublicKey1
        });

        oracles[1] = Agent({
            role: Role.ORACLE,
            isActive: true,
            publicKey: oraclePublicKey2
        });
    }

    /// @notice Register new patient
    /// @param publicKey Patient's X25519 public key
    function addPatient(
        bytes32 publicKey
    ) external validatePublicKey(publicKey) {
        require(
            !addressToAgent[msg.sender].isActive,
            "Error: Patient already onboarded"
        );

        addressToAgent[msg.sender] = Agent({
            role: Role.PATIENT,
            isActive: true,
            publicKey: publicKey
        });
        emit PatientAdded(msg.sender);
    }

    /// @notice Deactivate patient profile
    function revokePatient() external {
        require(
            addressToAgent[msg.sender].isActive &&
                addressToAgent[msg.sender].role == Role.PATIENT,
            "Error: Patient not registered"
        );
        addressToAgent[msg.sender].isActive = false;
    }

    /// @notice Register new physician
    /// @param physicianAddress Physician wallet address
    /// @param publicKey Physician's X25519 public key
    function addPhysician(
        address physicianAddress,
        bytes32 publicKey
    ) external onlyHospital validatePublicKey(publicKey) {
        require(
            !addressToAgent[physicianAddress].isActive,
            "Error: Physician already onboarded"
        );

        addressToAgent[physicianAddress] = Agent({
            role: Role.PHYSICIAN,
            isActive: true,
            publicKey: publicKey
        });
        authorizedPhysiciansByHospital[physicianAddress] = true;

        emit PhysicianAdded(physicianAddress);
    }

    /// @notice Revoke physician privileges
    /// @param physicianAddress Address to revoke
    function revokePhysician(address physicianAddress) external onlyHospital {
        require(
            addressToAgent[physicianAddress].isActive &&
                addressToAgent[physicianAddress].role == Role.PHYSICIAN,
            "Error: Physician not registered"
        );

        authorizedPhysiciansByHospital[physicianAddress] = false;
        addressToAgent[physicianAddress].isActive = false;
    }

    /// @notice Transfer hospital admin privileges
    /// @param newHospitalAddress New admin address
    /// @param publicKey New admin's public key
    function updateHospital(
        address newHospitalAddress,
        bytes32 publicKey
    ) external onlyHospital validatePublicKey(publicKey) {
        addressToAgent[newHospitalAddress] = Agent({
            role: Role.HOSPITAL,
            isActive: true,
            publicKey: publicKey
        });

        hospital = newHospitalAddress;
        addressToAgent[msg.sender].isActive = false;

        emit HospitalUpdated(newHospitalAddress);
    }

    /// @notice Update oracle public key
    /// @param oracleIndex Which oracle to update (0 or 1)
    /// @param publicKey New public key
    function updateOraclePubKey(
        uint8 oracleIndex,
        bytes32 publicKey
    ) external onlyHospital validatePublicKey(publicKey) {
        require(oracleIndex < 2, "Error: Invalid oracle index");
        oracles[oracleIndex].publicKey = publicKey;
    }

    /// @notice Get oracle details
    /// @param index Oracle index (0 or 1)
    /// @return Oracle agent details
    function getOracle(uint8 index) external view returns (Agent memory) {
        require(index < 2, "Error: Invalid oracle index");
        return oracles[index];
    }

    /// @notice Get all agents related to a patient
    /// @param _patient Patient address
    /// @return Array of 5 agents: [physician, patient, hospital, oracle1, oracle2]
    function getAgents(
        address _patient
    ) external view onlyAuthorizedPhysician returns (Agent[] memory) {
        require(
            addressToAgent[_patient].isActive &&
                addressToAgent[_patient].role == Role.PATIENT,
            "Error: Invalid patient address"
        );

        Agent[] memory agents = new Agent[](5);
        agents[0] = addressToAgent[msg.sender]; // Physician
        agents[1] = addressToAgent[_patient]; // Patient
        agents[2] = addressToAgent[hospital]; // Hospital
        agents[3] = oracles[0]; // Oracle 1
        agents[4] = oracles[1]; // Oracle 2

        return agents;
    }
}
