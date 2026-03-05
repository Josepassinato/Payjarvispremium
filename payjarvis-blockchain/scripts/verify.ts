import hre, { ethers } from "hardhat";

async function main() {
  const registryAddress = process.env.REGISTRY_CONTRACT_ADDRESS;
  const anchoringAddress = process.env.ANCHORING_CONTRACT_ADDRESS;

  if (!registryAddress || !anchoringAddress) {
    throw new Error(
      "Set REGISTRY_CONTRACT_ADDRESS and ANCHORING_CONTRACT_ADDRESS env vars"
    );
  }

  const [deployer] = await ethers.getSigners();

  console.log("Verifying PayJarvisRegistry...");
  try {
    await hre.run("verify:verify", {
      address: registryAddress,
      constructorArguments: [deployer.address],
    });
    console.log("PayJarvisRegistry verified!");
  } catch (err) {
    console.error("Registry verification failed:", err);
  }

  console.log("Verifying PayJarvisAnchoring...");
  try {
    await hre.run("verify:verify", {
      address: anchoringAddress,
      constructorArguments: [deployer.address],
    });
    console.log("PayJarvisAnchoring verified!");
  } catch (err) {
    console.error("Anchoring verification failed:", err);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
