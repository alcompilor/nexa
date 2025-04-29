// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "./RoleBase.sol";

/// @title EHR Management Contract
/// @notice Handles EHR record lifecycle and oracle interactions
contract EHRManager is RoleBase {
    /// @dev Patient address => Record ID => Record
    mapping(address => mapping(uint32 => Record)) internal patientToRecords;

    /// @dev Patient address => Record count
    mapping(address => uint32) internal patientToRecordsCount;

    /// @notice Initiate oracle assistance request
    /// @param _requestId Unique request identifier
    /// @param _record EHR record containing oracle shares
    function requestOracleAssistance(
        bytes16 _requestId,
        Record calldata _record
    ) external onlyAuthorizedPhysicianOrPatient(msg.sender) onlyActiveAgent {
        EncryptedShare[2] memory oracleShares;
        uint j = 0;

        // Extract oracle shares from record
        for (uint i = 0; i < 5; i++) {
            if (_record.encryptedKeyShares[i].role == Role.ORACLE) {
                oracleShares[j] = _record.encryptedKeyShares[i];
                j++;
                if (j == 2) break;
            }
        }

        emit KeySharesRequested(
            _requestId,
            addressToAgent[msg.sender].publicKey,
            oracleShares
        );
    }

    /// @notice Submit re-encrypted oracle shares
    /// @param _requestId Original request identifier
    /// @param _isSuccess Operation status
    /// @param _reEncryptedKeyShares Processed oracle shares
    function submitReEncryptedShare(
        bytes16 _requestId,
        bool _isSuccess,
        EncryptedShare[2] calldata _reEncryptedKeyShares
    ) external {
        emit KeySharesResponse(_requestId, _reEncryptedKeyShares, _isSuccess);
    }

    /// @notice Add new EHR record for patient
    /// @param _patientAddress Patient's wallet address
    /// @param _record EHR record metadata
    function addRecord(
        address _patientAddress,
        Record calldata _record
    ) external onlyAuthorizedPhysician {
        require(
            addressToAgent[_patientAddress].isActive &&
                addressToAgent[_patientAddress].role == Role.PATIENT,
            "Error: Not a registered patient in hospital"
        );

        patientToRecords[_patientAddress][
            patientToRecordsCount[_patientAddress]
        ] = _record;

        patientToRecordsCount[_patientAddress]++;
    }

    /// @notice Get patient's latest EHR record
    /// @param _patientAddress Patient's wallet address
    /// @return Latest EHR record
    function getLatestRecord(
        address _patientAddress
    )
        external
        view
        onlyAuthorizedPhysicianOrPatient(_patientAddress)
        returns (Record memory)
    {
        require(
            patientToRecordsCount[_patientAddress] > 0,
            "Error: No records found"
        );
        return
            patientToRecords[_patientAddress][
                patientToRecordsCount[_patientAddress] - 1
            ];
    }

    /// @notice Get specific EHR record by index
    /// @param _patientAddress Patient's wallet address
    /// @param _recordNumber Record index
    /// @return Requested EHR record
    function getRecord(
        address _patientAddress,
        uint32 _recordNumber
    )
        external
        view
        onlyAuthorizedPhysicianOrPatient(_patientAddress)
        returns (Record memory)
    {
        require(
            _recordNumber < patientToRecordsCount[_patientAddress],
            "Error: Invalid record number"
        );
        return patientToRecords[_patientAddress][_recordNumber];
    }

    /// @notice Get total record count for patient
    /// @param _patientAddress Patient's wallet address
    /// @return Number of stored records
    function getRecordCount(
        address _patientAddress
    )
        external
        view
        onlyAuthorizedPhysicianOrPatient(_patientAddress)
        returns (uint32)
    {
        return patientToRecordsCount[_patientAddress];
    }
}
