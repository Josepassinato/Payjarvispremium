import { expect } from "chai";
import { ethers } from "hardhat";
import { PayJarvisRegistry } from "../typechain-types";

describe("PayJarvisRegistry", function () {
  let registry: PayJarvisRegistry;
  let owner: any;
  let issuer: any;
  let other: any;

  const agentId = ethers.keccak256(ethers.toUtf8Bytes("testvendor:testagent"));
  const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("metadata"));

  beforeEach(async function () {
    [owner, issuer, other] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("PayJarvisRegistry");
    registry = await Registry.deploy(issuer.address);
    await registry.waitForDeployment();
  });

  describe("registerAgent", function () {
    it("should register an agent as issuer", async function () {
      await registry.connect(issuer).registerAgent(agentId, metadataHash);
      expect(await registry.isAgentActive(agentId)).to.equal(true);
    });

    it("should register an agent as owner", async function () {
      await registry.connect(owner).registerAgent(agentId, metadataHash);
      expect(await registry.isAgentActive(agentId)).to.equal(true);
    });

    it("should reject registration from unauthorized address", async function () {
      await expect(
        registry.connect(other).registerAgent(agentId, metadataHash)
      ).to.be.revertedWith("Not authorized");
    });

    it("should reject duplicate registration", async function () {
      await registry.connect(issuer).registerAgent(agentId, metadataHash);
      await expect(
        registry.connect(issuer).registerAgent(agentId, metadataHash)
      ).to.be.revertedWith("Already registered");
    });

    it("should emit AgentRegistered event", async function () {
      await expect(registry.connect(issuer).registerAgent(agentId, metadataHash))
        .to.emit(registry, "AgentRegistered")
        .withArgs(agentId, metadataHash, await getBlockTimestamp());
    });
  });

  describe("revokeAgent", function () {
    beforeEach(async function () {
      await registry.connect(issuer).registerAgent(agentId, metadataHash);
    });

    it("should revoke an active agent", async function () {
      await registry.connect(issuer).revokeAgent(agentId, "POLICY_VIOLATION");
      expect(await registry.isAgentActive(agentId)).to.equal(false);
    });

    it("should reject revoking inactive agent", async function () {
      await registry.connect(issuer).revokeAgent(agentId, "TEST");
      await expect(
        registry.connect(issuer).revokeAgent(agentId, "DOUBLE_REVOKE")
      ).to.be.revertedWith("Not active");
    });

    it("should store reason code", async function () {
      await registry.connect(issuer).revokeAgent(agentId, "POLICY_VIOLATION");
      const agent = await registry.getAgent(agentId);
      expect(agent.reasonCode).to.equal("POLICY_VIOLATION");
    });
  });

  describe("getAgent", function () {
    it("should return agent details", async function () {
      await registry.connect(issuer).registerAgent(agentId, metadataHash);
      const agent = await registry.getAgent(agentId);
      expect(agent.active).to.equal(true);
      expect(agent.metadataHash).to.equal(metadataHash);
      expect(agent.revokedAt).to.equal(0);
    });
  });

  describe("setIssuer", function () {
    it("should allow owner to change issuer", async function () {
      await registry.connect(owner).setIssuer(other.address);
      expect(await registry.issuer()).to.equal(other.address);
    });

    it("should reject non-owner", async function () {
      await expect(
        registry.connect(other).setIssuer(other.address)
      ).to.be.revertedWith("Only owner");
    });
  });
});

async function getBlockTimestamp(): Promise<number> {
  const block = await ethers.provider.getBlock("latest");
  return block!.timestamp;
}
