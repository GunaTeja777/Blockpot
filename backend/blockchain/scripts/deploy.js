const fs = require("fs");
const { ethers } = require('ethers');
async function main() {
  // Set the provider (using environment variable for Sepolia RPC URL)
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  
  // Set the signer (using the wallet private key from the environment)
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // Get the contract factory for "LogStorage"
  const LogStorage = await ethers.getContractFactory("LogStorage", wallet);

  // Specify the gas price (example: 5 Gwei)
  const gasPrice = ethers.utils.parseUnits('5', 'gwei');  // Adjust as needed

  // Deploy the contract with a lower gas price
  const logStorage = await LogStorage.deploy({
    gasPrice: gasPrice,  // Set the custom gas price here
    gasLimit: 3000000,  // Ensure this is enough for the contract deployment
  });

  console.log("LogStorage deployed to:", logStorage.target); // Use `.target` for ethers v6

  // Save the deployed contract address to a JSON file
  fs.writeFileSync(
    "./contractAddress.json",
    JSON.stringify({ address: logStorage.target }, null, 2) // Use .target for ethers v6
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
