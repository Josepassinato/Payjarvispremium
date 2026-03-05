import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Deploy PayJarvisRegistry
  const Registry = await ethers.getContractFactory("PayJarvisRegistry");
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("PayJarvisRegistry deployed to:", registryAddress);

  // Deploy PayJarvisAnchoring
  const Anchoring = await ethers.getContractFactory("PayJarvisAnchoring");
  const anchoring = await Anchoring.deploy(deployer.address);
  await anchoring.waitForDeployment();
  const anchoringAddress = await anchoring.getAddress();
  console.log("PayJarvisAnchoring deployed to:", anchoringAddress);

  console.log("\n--- Deployment Summary ---");
  console.log(`REGISTRY_CONTRACT_ADDRESS=${registryAddress}`);
  console.log(`ANCHORING_CONTRACT_ADDRESS=${anchoringAddress}`);
  console.log("--- End Summary ---\n");

  // Wait for confirmations before verification
  console.log("Waiting for block confirmations...");
  await new Promise((resolve) => setTimeout(resolve, 30000));

  return { registryAddress, anchoringAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
