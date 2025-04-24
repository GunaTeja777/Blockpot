// Load environment variables from .env file
require('dotenv').config();

// Import necessary modules
const fs = require('fs');
const { ethers } = require('ethers');  // Correctly import ethers

async function main() {
    // Setup provider using Sepolia RPC URL
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    
    // Set up wallet using private key from environment variables
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Create a contract factory for the LogStorage contract
    const LogStorage = await ethers.getContractFactory("LogStorage", wallet);

    // Set the gas price (adjust this value based on the current network gas prices)
    const gasPrice = await provider.getGasPrice(); // Fetch current gas price

    // Deploy the contract with custom gas price and gas limit
    const logStorage = await LogStorage.deploy({
        gasPrice: gasPrice,               // Gas price fetched from the provider
        gasLimit: 3000000,                // Gas limit (adjust if needed)
    });

    // Wait for the contract to be mined
    await logStorage.deployed();

    // Output the contract address
    console.log("LogStorage deployed to:", logStorage.address);  // Correct usage of `.address` in ethers v6

    // Save the contract address to a JSON file for future use
    fs.writeFileSync(
        "./contractAddress.json",
        JSON.stringify({ address: logStorage.address }, null, 2) // Use .address to get the deployed address
    );
}

// Execute the deployment process
main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exitCode = 1; // Exit with failure code
});
