const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const logStorageArtifact = require("../abi/LogStorage.json");

  const LogStorage = new ethers.ContractFactory(
    logStorageArtifact.abi,
    logStorageArtifact.bytecode,
    wallet
  );

  const gasPrice = ethers.utils.parseUnits("5", "gwei");

  const logStorage = await LogStorage.deploy({
    gasPrice: gasPrice,
    gasLimit: 102756,
  });

  await logStorage.deployed();

  console.log("LogStorage deployed to:", logStorage.address);

  fs.writeFileSync(
    "./contractAddress.json",
    JSON.stringify({ address: logStorage.address }, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
