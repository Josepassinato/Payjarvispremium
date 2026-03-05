// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PayJarvisAnchoring {
    address public owner;
    address public publisher;

    struct AnchorRecord {
        bytes32 merkleRoot;
        uint256 periodStart;
        uint256 periodEnd;
        uint256 eventCount;
        uint8 schemaVersion;
        string issuerId;
        uint256 timestamp;
    }

    AnchorRecord[] public records;

    event RootAnchored(
        uint256 indexed index,
        bytes32 merkleRoot,
        uint256 periodStart,
        uint256 periodEnd,
        uint256 eventCount,
        uint256 timestamp
    );

    modifier onlyPublisher() {
        require(msg.sender == publisher || msg.sender == owner, "Not authorized");
        _;
    }

    constructor(address _publisher) {
        owner = msg.sender;
        publisher = _publisher;
    }

    function anchorRoot(
        bytes32 merkleRoot,
        uint256 periodStart,
        uint256 periodEnd,
        uint256 eventCount,
        uint8 schemaVersion,
        string calldata issuerId
    ) external onlyPublisher returns (uint256 index) {
        index = records.length;
        records.push(AnchorRecord({
            merkleRoot: merkleRoot,
            periodStart: periodStart,
            periodEnd: periodEnd,
            eventCount: eventCount,
            schemaVersion: schemaVersion,
            issuerId: issuerId,
            timestamp: block.timestamp
        }));
        emit RootAnchored(index, merkleRoot, periodStart, periodEnd, eventCount, block.timestamp);
    }

    function getRecord(uint256 index) external view returns (AnchorRecord memory) {
        require(index < records.length, "Index out of bounds");
        return records[index];
    }

    function getLatestRecord() external view returns (AnchorRecord memory, uint256 index) {
        require(records.length > 0, "No records");
        index = records.length - 1;
        return (records[index], index);
    }

    function totalRecords() external view returns (uint256) {
        return records.length;
    }

    function setPublisher(address _publisher) external {
        require(msg.sender == owner, "Only owner");
        publisher = _publisher;
    }
}
