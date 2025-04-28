const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const LogStorage = await ethers.getContractFactory("LogStorage");
  const logStorage = await LogStorage.deploy();
  
  // Wait for deployment to complete
  await logStorage.waitForDeployment();
  
  // Get the deployed contract address
  const address = await logStorage.getAddress();
  console.log("LogStorage deployed to:", address);
  
  // Save address to JSON file
  fs.writeFileSync(
    "./contractAddress.json",
    JSON.stringify({ address: address }, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});