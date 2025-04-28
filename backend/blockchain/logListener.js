const WebSocket = require("ws");
const { ethers } = require("ethers");
const fs = require("fs");

// Load ABI and contract address
const abiFile = require("/home/anand/Desktop/Blockpot/backend/blockchain/abi/LogStorage.json");
const abi = abiFile.abi; // Access the ABI from the object

const { address: contractAddress } = require("/home/anand/Desktop/Blockpot/backend/blockchain/contractAddress.json");

// Connect to local Hardhat node
const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
let signer;
let contract;

async function init() {
  const accounts = await provider.listAccounts();
  signer = await provider.getSigner(accounts[0]);
  contract = new ethers.Contract(contractAddress, abi, signer);
  console.log("✅ Connected to contract at", contractAddress);
}

init().then(() => {
  // Connect to Cowrie WebSocket logs
  const ws = new WebSocket("ws://127.0.0.1:8080");

  ws.on("open", () => console.log("🌐 WebSocket connected to Cowrie"));
  ws.on("close", () => console.log("❌ WebSocket disconnected"));
  ws.on("error", (err) => console.error("WebSocket error:", err));

  ws.on("message", async (data) => {
    const log = data.toString();
    console.log("📥 Log received:", log);

    try {
      // Store the log in the blockchain contract
      const tx = await contract.storeLog(log);
      await tx.wait();
      console.log("✅ Log stored in blockchain:", tx.hash);
    } catch (err) {
      console.error("❌ Error storing log:", err.message);
    }
  });
});
