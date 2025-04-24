// Import necessary modules
const fs = require("fs");
const { ethers } = require("ethers"); // Import ethers correctly
require("dotenv").config();

async function main() {
  // Set the provider (using environment variable for Sepolia RPC URL)
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

  // Set the signer (using the wallet private key from the environment)
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // Reference the contract ABI and bytecode from your 'abi' folder
  const logStorageArtifact = require("../../../../abi/LogStorage.json"); // Correct path based on your directory

  // Create contract factory using ABI and bytecode
  const LogStorage = new ethers.ContractFactory(
    logStorageArtifact.abi,
    logStorageArtifact.bytecode,
    wallet
  );

  // Specify the gas price (example: 5 Gwei)
  const gasPrice = ethers.utils.parseUnits("5", "gwei"); // Adjust as needed

  // Deploy the contract with a lower gas price
  const logStorage = await LogStorage.deploy({
    gasPrice: gasPrice,  // Set the custom gas price here
    gasLimit: 3000000,   // Ensure this is enough for the contract deployment
  });

  // Wait for the contract to be mined
  await logStorage.deployed();

  console.log("LogStorage deployed to:", logStorage.address); // Use `.address` in ethers v6

  // Save the deployed contract address to a JSON file
  fs.writeFileSync(
    "./contractAddress.json",
    JSON.stringify({ address: logStorage.address }, null, 2) // Use .address to get the contract address
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
