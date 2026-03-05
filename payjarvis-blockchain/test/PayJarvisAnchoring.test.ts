import { expect } from "chai";
import { ethers } from "hardhat";
import { PayJarvisAnchoring } from "../typechain-types";

describe("PayJarvisAnchoring", function () {
  let anchoring: PayJarvisAnchoring;
  let owner: any;
  let publisher: any;
  let other: any;

  const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test-merkle-root"));
  const periodStart = 1700000000;
  const periodEnd = 1700086400;
  const eventCount = 42;
  const schemaVersion = 1;
  const issuerId = "did:example:payjarvis";

  beforeEach(async function () {
    [owner, publisher, other] = await ethers.getSigners();

    const Anchoring = await ethers.getContractFactory("PayJarvisAnchoring");
    anchoring = await Anchoring.deploy(publisher.address);
    await anchoring.waitForDeployment();
  });

  describe("anchorRoot", function () {
    it("should anchor a root as publisher", async function () {
      const tx = await anchoring
        .connect(publisher)
        .anchorRoot(merkleRoot, periodStart, periodEnd, eventCount, schemaVersion, issuerId);

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;
      expect(await anchoring.totalRecords()).to.equal(1);
    });

    it("should anchor a root as owner", async function () {
      await anchoring
        .connect(owner)
        .anchorRoot(merkleRoot, periodStart, periodEnd, eventCount, schemaVersion, issuerId);

      expect(await anchoring.totalRecords()).to.equal(1);
    });

    it("should reject unauthorized address", async function () {
      await expect(
        anchoring
          .connect(other)
          .anchorRoot(merkleRoot, periodStart, periodEnd, eventCount, schemaVersion, issuerId)
      ).to.be.revertedWith("Not authorized");
    });

    it("should emit RootAnchored event", async function () {
      await expect(
        anchoring
          .connect(publisher)
          .anchorRoot(merkleRoot, periodStart, periodEnd, eventCount, schemaVersion, issuerId)
      )
        .to.emit(anchoring, "RootAnchored")
        .withArgs(0, merkleRoot, periodStart, periodEnd, eventCount, await getBlockTimestamp());
    });

    it("should increment record index", async function () {
      await anchoring
        .connect(publisher)
        .anchorRoot(merkleRoot, periodStart, periodEnd, eventCount, schemaVersion, issuerId);

      const root2 = ethers.keccak256(ethers.toUtf8Bytes("root-2"));
      await anchoring
        .connect(publisher)
        .anchorRoot(root2, periodEnd, periodEnd + 86400, 10, schemaVersion, issuerId);

      expect(await anchoring.totalRecords()).to.equal(2);
    });
  });

  describe("getRecord", function () {
    beforeEach(async function () {
      await anchoring
        .connect(publisher)
        .anchorRoot(merkleRoot, periodStart, periodEnd, eventCount, schemaVersion, issuerId);
    });

    it("should return stored record", async function () {
      const record = await anchoring.getRecord(0);
      expect(record.merkleRoot).to.equal(merkleRoot);
      expect(record.eventCount).to.equal(eventCount);
      expect(record.schemaVersion).to.equal(schemaVersion);
      expect(record.issuerId).to.equal(issuerId);
    });

    it("should revert for out-of-bounds index", async function () {
      await expect(anchoring.getRecord(999)).to.be.revertedWith("Index out of bounds");
    });
  });

  describe("getLatestRecord", function () {
    it("should revert when no records exist", async function () {
      await expect(anchoring.getLatestRecord()).to.be.revertedWith("No records");
    });

    it("should return latest record", async function () {
      await anchoring
        .connect(publisher)
        .anchorRoot(merkleRoot, periodStart, periodEnd, eventCount, schemaVersion, issuerId);

      const [record, index] = await anchoring.getLatestRecord();
      expect(index).to.equal(0);
      expect(record.merkleRoot).to.equal(merkleRoot);
    });
  });

  describe("setPublisher", function () {
    it("should allow owner to change publisher", async function () {
      await anchoring.connect(owner).setPublisher(other.address);
      expect(await anchoring.publisher()).to.equal(other.address);
    });

    it("should reject non-owner", async function () {
      await expect(
        anchoring.connect(other).setPublisher(other.address)
      ).to.be.revertedWith("Only owner");
    });
  });
});

async function getBlockTimestamp(): Promise<number> {
  const block = await ethers.provider.getBlock("latest");
  return block!.timestamp;
}
