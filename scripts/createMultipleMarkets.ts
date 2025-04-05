import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";

// Load .env file
dotenv.config();

async function main() {
  console.log("Creating multiple markets...");
  console.log("Network:", network.name);

  // Set RangeBetManager address according to network
  let rangeBetManagerAddress = "";

  if (network.name === "localhost") {
    // Local deployment address (value from deployment script output)
    rangeBetManagerAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  } else if (network.name === "rskTestnet") {
    // For RSK Testnet, use environment variables
    rangeBetManagerAddress = process.env.RSK_RANGE_BET_MANAGER || "";

    if (!rangeBetManagerAddress) {
      console.error("RSK_RANGE_BET_MANAGER is not set in the .env file");
      process.exit(1);
    }
  } else {
    // For other networks, check if environment variables exist
    console.error(
      `RangeBetManager address for network '${network.name}' is not configured`
    );
    process.exit(1);
  }

  console.log("Using RangeBetManager contract:", rangeBetManagerAddress);

  // Get contract instance
  const rangeBetManager = await ethers.getContractAt(
    "RangeBetManager",
    rangeBetManagerAddress
  );

  // Set parameters same as sample market
  const tickSpacing = 60;
  const minTick = -360;
  const maxTick = 120000;

  // Based on current time
  const now = Math.floor(Date.now() / 1000);
  const oneDay = 24 * 60 * 60; // One day (in seconds)

  // 15 days forward, 15 days backward = 31 markets total (including current)
  const daysBack = 15;
  const daysFuture = 15;

  // Array to store results
  const createdMarkets = [];

  console.log("\n--- Creating markets ---");

  // Create past markets (already closed markets)
  for (let i = daysBack; i > 0; i--) {
    const closeTime = now - i * oneDay;
    console.log(`Creating market ${daysBack - i + 1}/30 (${i} days ago):`);
    console.log(
      `- closeTime: ${closeTime} (${new Date(
        closeTime * 1000
      ).toLocaleString()})`
    );

    try {
      const tx = await rangeBetManager.createMarket(
        tickSpacing,
        minTick,
        maxTick,
        closeTime
      );
      await tx.wait();

      // Created market ID is total number of markets - 1
      const marketId = Number(await rangeBetManager.marketCount()) - 1;
      createdMarkets.push({
        marketId,
        closeTime,
        status: "created (past)",
      });

      console.log(`- Market created with ID: ${marketId}`);
    } catch (error: any) {
      console.error(`- Failed to create market: ${error?.message || error}`);
    }
  }

  // Create future markets
  for (let i = 1; i <= daysFuture; i++) {
    const closeTime = now + (7 + i) * oneDay; // Closes after a week + i days
    console.log(
      `\nCreating market ${daysBack + 1 + i}/30 (${i} days in future):`
    );
    console.log(
      `- closeTime: ${closeTime} (${new Date(
        closeTime * 1000
      ).toLocaleString()})`
    );

    try {
      const tx = await rangeBetManager.createMarket(
        tickSpacing,
        minTick,
        maxTick,
        closeTime
      );
      await tx.wait();

      const marketId = Number(await rangeBetManager.marketCount()) - 1;
      createdMarkets.push({
        marketId,
        closeTime,
        status: "created (future)",
      });

      console.log(`- Market created with ID: ${marketId}`);
    } catch (error: any) {
      console.error(`- Failed to create market: ${error?.message || error}`);
    }
  }

  // Print summary of results
  console.log("\n--- Summary of created markets ---");
  console.log(`Total markets created: ${createdMarkets.length}`);
  createdMarkets.forEach((market, index) => {
    console.log(
      `${index + 1}. Market ID: ${market.marketId}, Close time: ${new Date(
        market.closeTime * 1000
      ).toLocaleString()}, Status: ${market.status}`
    );
  });

  console.log("\n--- Process completed successfully ---");
}

// Execute script and handle errors
main().catch((error: any) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
