// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LogStorage {
    event LogStored(
        address indexed sender,
        string indexed ip,
        string command,
        string threatLevel,
        uint256 timestamp,
        bytes32 logId
    );

    struct Log {
        string ip;
        string command;
        string threatLevel;
        uint256 timestamp;
        bytes32 id;
    }

    Log[] public logs;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function storeLog(
        string memory ip,
        string memory command,
        string memory threatLevel,
        uint256 timestamp
    ) external returns (bytes32) {
        bytes32 logId = keccak256(abi.encodePacked(ip, command, block.timestamp));
        
        logs.push(Log({
            ip: ip,
            command: command,
            threatLevel: threatLevel,
            timestamp: timestamp,
            id: logId
        }));

        emit LogStored(
            msg.sender,
            ip,
            command,
            threatLevel,
            timestamp,
            logId
        );

        return logId;
    }

    function getLogCount() external view returns (uint256) {
        return logs.length;
    }

    function getLog(uint256 index) external view returns (
        string memory,
        string memory,
        string memory,
        uint256,
        bytes32
    ) {
        require(index < logs.length, "Index out of bounds");
        Log memory log = logs[index];
        return (log.ip, log.command, log.threatLevel, log.timestamp, log.id);
    }
}