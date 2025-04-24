const fs = require("fs");

async function main() {
  const LogStorage = await ethers.getContractFactory("LogStorage");
  const logStorage = await LogStorage.deploy(); // Deploy already waits for confirmation

  console.log("LogStorage deployed to:", logStorage.target); // Use `.target` instead of `.address` in ethers v6

  // Save address to JSON file
  fs.writeFileSync(
    "./contractAddress.json",
    JSON.stringify({ address: logStorage.target }, null, 2) // Use .target
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
