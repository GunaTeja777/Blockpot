const WebSocket = require("ws");
const { ethers } = require("ethers");
const fs = require("fs");
const abi = require("./abi/LogStorage.json");

// Load deployed address
const { address: contractAddress } = require("./contractAddress.json");

// Connect to local Hardhat node
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
let signer;

// Connect to contract
let contract;

async function init() {
  const accounts = await provider.listAccounts();
  signer = await provider.getSigner(accounts[0]);
  contract = new ethers.Contract(contractAddress, abi, signer);
  console.log("✅ Connected to contract at", contractAddress);
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
      const tx = await contract.storeLog(log);
      await tx.wait();
      console.log("✅ Log stored in blockchain:", tx.hash);
    } catch (err) {
      console.error("❌ Error storing log:", err.message);
    }
  });
});
