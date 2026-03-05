// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PayJarvisRegistry {
    address public owner;
    address public issuer;

    struct Agent {
        bool active;
        uint256 registeredAt;
        uint256 revokedAt;
        bytes32 metadataHash;
        string reasonCode;
    }

    mapping(bytes32 => Agent) private agents;

    event AgentRegistered(bytes32 indexed agentPublicId, bytes32 metadataHash, uint256 timestamp);
    event AgentRevoked(bytes32 indexed agentPublicId, string reasonCode, uint256 timestamp);

    modifier onlyIssuer() {
        require(msg.sender == issuer || msg.sender == owner, "Not authorized");
        _;
    }

    constructor(address _issuer) {
        owner = msg.sender;
        issuer = _issuer;
    }

    function registerAgent(bytes32 agentPublicId, bytes32 metadataHash) external onlyIssuer {
        require(!agents[agentPublicId].active, "Already registered");
        agents[agentPublicId] = Agent({
            active: true,
            registeredAt: block.timestamp,
            revokedAt: 0,
            metadataHash: metadataHash,
            reasonCode: ""
        });
        emit AgentRegistered(agentPublicId, metadataHash, block.timestamp);
    }

    function revokeAgent(bytes32 agentPublicId, string calldata reasonCode) external onlyIssuer {
        require(agents[agentPublicId].active, "Not active");
        agents[agentPublicId].active = false;
        agents[agentPublicId].revokedAt = block.timestamp;
        agents[agentPublicId].reasonCode = reasonCode;
        emit AgentRevoked(agentPublicId, reasonCode, block.timestamp);
    }

    function isAgentActive(bytes32 agentPublicId) external view returns (bool) {
        return agents[agentPublicId].active;
    }

    function getAgent(bytes32 agentPublicId) external view returns (
        bool active,
        uint256 registeredAt,
        uint256 revokedAt,
        bytes32 metadataHash,
        string memory reasonCode
    ) {
        Agent memory a = agents[agentPublicId];
        return (a.active, a.registeredAt, a.revokedAt, a.metadataHash, a.reasonCode);
    }

    function setIssuer(address _issuer) external {
        require(msg.sender == owner, "Only owner");
        issuer = _issuer;
    }
}
