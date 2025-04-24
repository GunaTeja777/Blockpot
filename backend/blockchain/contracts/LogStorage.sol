// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LogStorage {
    struct LogEntry {
        string ip;
        string command;
        string threatLevel;
        string timestamp;
    }

    LogEntry[] public logs;

    // Fixed typo in event parameter name from 'laogId' to 'logId'
    event LogStored(uint indexed logId, string ip, string command, string threatLevel, string timestamp);

    function storeLog(string memory ip, string memory command, string memory threatLevel, string memory timestamp) public {
        logs.push(LogEntry(ip, command, threatLevel, timestamp));
        emit LogStored(logs.length - 1, ip, command, threatLevel, timestamp);
    }

    function getLogCount() public view returns (uint) {
        return logs.length;
    }

    function getLog(uint index) public view returns (string memory, string memory, string memory, string memory) {
        require(index < logs.length, "Invalid index");
        LogEntry memory entry = logs[index];
        return (entry.ip, entry.command, entry.threatLevel, entry.timestamp);
    }
}
