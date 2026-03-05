// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPayJarvisRegistry {
    event AgentRegistered(bytes32 indexed agentPublicId, bytes32 metadataHash, uint256 timestamp);
    event AgentRevoked(bytes32 indexed agentPublicId, string reasonCode, uint256 timestamp);

    function registerAgent(bytes32 agentPublicId, bytes32 metadataHash) external;
    function revokeAgent(bytes32 agentPublicId, string calldata reasonCode) external;
    function isAgentActive(bytes32 agentPublicId) external view returns (bool);
    function getAgent(bytes32 agentPublicId) external view returns (
        bool active,
        uint256 registeredAt,
        uint256 revokedAt,
        bytes32 metadataHash,
        string memory reasonCode
    );
    function setIssuer(address _issuer) external;
}
