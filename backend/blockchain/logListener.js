const WebSocket = require("ws");
const { ethers } = require("ethers");
const fs = require("fs");

// Load ABI and contract address
const abi = require("/home/anand/Desktop/Blockpot/backend/blockchain/abi/LogStorage.json");
const { address: contractAddress } = require("/home/anand/Desktop/Blockpot/backend/blockchain/contractAddress.json");

// Ensure ABI is an array before proceeding
if (!Array.isArray(abi)) {
  console.error("❌ ABI is not an array. Please check the ABI file format.");
} else {
  // Connect to local Hardhat node
  const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
  let signer;
  let contract;

  async function init() {
    try {
      const accounts = await provider.listAccounts();
      signer = await provider.getSigner(accounts[0]);
      contract = new ethers.Contract(contractAddress, abi, signer);
      console.log("✅ Connected to contract at", contractAddress);
    } catch (err) {
      console.error("❌ Error during contract initialization:", err.message);
    }
  }

  init().then(() => {
    // Connect to Cowrie WebSocket logs (replace port if needed)
    const ws = new WebSocket("ws://127.0.0.1:8080");

    ws.on("open", () => console.log("🌐 WebSocket connected to Cowrie"));
    ws.on("close", () => console.log("❌ WebSocket disconnected"));
    ws.on("error", (err) => console.error("WebSocket error:", err));

    ws.on("message", async (data) => {
      const log = data.toString();
      console.log("📥 Log received:", log);

      try {
        // Assuming log is an object, adjust according to your log format
        const { ip, command, threatLevel, timestamp } = JSON.parse(log);

        const tx = await contract.storeLog(ip, command, threatLevel, timestamp);
        await tx.wait();
        console.log("✅ Log stored in blockchain:", tx.hash);
      } catch (err) {
        console.error("❌ Error storing log:", err.message);
      }
    });
  });
}
