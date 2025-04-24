require("@nomicfoundation/hardhat-ethers");

require("dotenv").config();

module.exports = {
  solidity: "0.8.0",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL, // Make sure this is set in .env
      accounts: [process.env.PRIVATE_KEY], // Make sure this is set in .env
    },
  },
};
