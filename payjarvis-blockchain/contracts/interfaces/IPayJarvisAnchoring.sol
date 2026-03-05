// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPayJarvisAnchoring {
    struct AnchorRecord {
        bytes32 merkleRoot;
        uint256 periodStart;
        uint256 periodEnd;
        uint256 eventCount;
        uint8 schemaVersion;
        string issuerId;
        uint256 timestamp;
    }

    event RootAnchored(
        uint256 indexed index,
        bytes32 merkleRoot,
        uint256 periodStart,
        uint256 periodEnd,
        uint256 eventCount,
        uint256 timestamp
    );

    function anchorRoot(
        bytes32 merkleRoot,
        uint256 periodStart,
        uint256 periodEnd,
        uint256 eventCount,
        uint8 schemaVersion,
        string calldata issuerId
    ) external returns (uint256 index);

    function getRecord(uint256 index) external view returns (AnchorRecord memory);
    function getLatestRecord() external view returns (AnchorRecord memory, uint256 index);
    function totalRecords() external view returns (uint256);
    function setPublisher(address _publisher) external;
}
