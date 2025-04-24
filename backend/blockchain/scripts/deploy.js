const { ethers } = require('ethers');
const fs = require('fs');

async function main() {
    // Load contract ABI and bytecode
    const contractJson = JSON.parse(fs.readFileSync('./blockchain/abi/LogStorage.json'));

    // Set up provider and signer (private key)
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Create contract factory
    const contractFactory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet);

    // Specify lower gas price (example: 5 Gwei)
    const gasPrice = ethers.utils.parseUnits('5', 'gwei');

    // Deploy the contract with lower gas price
    const contract = await contractFactory.deploy({
        gasPrice: gasPrice,
        gasLimit: 3000000,  // Ensure this is enough for the contract deployment
    });

    console.log('Deploying contract...');

    // Wait for the contract to be mined
    const receipt = await contract.deployTransaction.wait();
    console.log('Contract deployed at address:', contract.address);
    console.log('Transaction hash:', contract.deployTransaction.hash);
    console.log('Block number:', receipt.blockNumber);
}

main().catch((error) => {
    console.error('Error in contract deployment:', error);
    process.exit(1);
});
