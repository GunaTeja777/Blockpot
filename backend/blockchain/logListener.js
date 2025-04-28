require("dotenv").config();
const WebSocket = require("ws");
const { ethers } = require("ethers");
const fs = require("fs");

// Load ABI and contract address
const abiFile = require("/home/anand/Desktop/Blockpot/backend/blockchain/abi/LogStorage.json");
const abi = abiFile.abi;

const { address: contractAddress } = require("/home/anand/Desktop/Blockpot/backend/blockchain/contractAddress.json");

// Connect to blockchain provider
const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
// If you want local Hardhat instead, use:
// const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");

let signer;
let contract;

async function init() {
  const accounts = await provider.listAccounts();
  signer = provider.getSigner(accounts[0]);
  contract = new ethers.Contract(contractAddress, abi, signer);
  console.log("✅ Connected to contract at", contractAddress);
}

init()
  .then(() => {
    console.log("🚀 Blockchain ready.");

    // === OPTIONAL: Connect to Cowrie WebSocket ===
    const COWRIE_WS_URL = "ws://127.0.0.1:8080";

    try {
      const ws = new WebSocket(COWRIE_WS_URL);

      ws.on("open", () => console.log(`🌐 Connected to Cowrie WebSocket at ${COWRIE_WS_URL}`));
      ws.on("close", () => console.log("❌ Cowrie WebSocket disconnected"));
      ws.on("error", (err) => console.error("⚠️ Cowrie WebSocket error:", err.message));

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
    } catch (error) {
      console.error("⚠️ Could not connect to Cowrie WebSocket:", error.message);
    }
    // === OPTIONAL Cowrie connection ends ===
  })
  .catch((err) => {
    console.error("❌ Initialization error:", err.message);
  });
