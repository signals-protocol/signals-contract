import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";

// 마켓 정보를 담을 인터페이스 정의
interface MarketInfo {
  marketId: number;
  closeTime: number;
  status: string;
}

// Load .env file
dotenv.config();

async function main() {
  console.log("Creating multiple markets...");
  console.log("Network:", network.name);

  // Set RangeBetManager address according to network
  let rangeBetManagerAddress = "";

  if (network.name === "localhost") {
    // Local deployment address (value from deployment script output)
    rangeBetManagerAddress = "0x0B306BF915C4d645ff596e518fAf3F9669b97016";
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

  // Arrays to prepare batch parameters
  const tickSpacings: number[] = [];
  const minTicks: number[] = [];
  const maxTicks: number[] = [];
  const closeTimes: number[] = [];

  console.log("\n--- Preparing market parameters ---");

  // Prepare parameters for past markets
  for (let i = daysBack; i > 0; i--) {
    const closeTime = now - i * oneDay;
    console.log(
      `Preparing market for ${i} days ago: ${new Date(
        closeTime * 1000
      ).toLocaleString()}`
    );

    tickSpacings.push(tickSpacing);
    minTicks.push(minTick);
    maxTicks.push(maxTick);
    closeTimes.push(closeTime);
  }

  // Prepare parameters for current day market
  console.log(
    `Preparing market for today: ${new Date(now * 1000).toLocaleString()}`
  );
  tickSpacings.push(tickSpacing);
  minTicks.push(minTick);
  maxTicks.push(maxTick);
  closeTimes.push(now);

  // Prepare parameters for future markets
  for (let i = 1; i <= daysFuture; i++) {
    const closeTime = now + i * oneDay;
    console.log(
      `Preparing market for ${i} days in future: ${new Date(
        closeTime * 1000
      ).toLocaleString()}`
    );

    tickSpacings.push(tickSpacing);
    minTicks.push(minTick);
    maxTicks.push(maxTick);
    closeTimes.push(closeTime);
  }

  console.log("\n--- Creating markets in batch ---");
  console.log(`Total markets to create: ${tickSpacings.length}`);

  try {
    // Use batch creation function instead of creating markets one by one
    console.log("Sending batch transaction to create all markets...");
    const tx = await rangeBetManager.getFunction("createBatchMarkets")(
      tickSpacings,
      minTicks,
      maxTicks,
      closeTimes
    );
    const receipt = await tx.wait();
    if (!receipt) {
      console.error(
        "Transaction receipt is null. Transaction may have failed."
      );
      return;
    }

    // Log transaction details
    console.log(`Batch Transaction Hash: ${receipt.hash}`);
    console.log(`Block Number: ${receipt.blockNumber}`);

    // Get the MarketCreated events
    const marketCreatedEvents = receipt.logs.filter(
      (log: any) => log.fragment && log.fragment.name === "MarketCreated"
    );

    const createdMarkets = marketCreatedEvents.map((event: any) => {
      const marketId = Number(event.args[0]);
      const closeTime = Number(event.args[5]);

      let status;
      if (closeTime < now) {
        status = "created (past)";
      } else if (closeTime === now) {
        status = "created (today)";
      } else {
        status = "created (future)";
      }

      return {
        marketId,
        closeTime,
        status,
      };
    });

    // Print summary of results
    console.log("\n--- Summary of created markets ---");
    console.log(`Total markets created: ${createdMarkets.length}`);
    createdMarkets.forEach((market: MarketInfo, index: number) => {
      console.log(
        `${index + 1}. Market ID: ${market.marketId}, Close time: ${new Date(
          market.closeTime * 1000
        ).toLocaleString()}, Status: ${market.status}`
      );
    });

    console.log("\n--- Process completed successfully ---");
  } catch (error: any) {
    console.error(
      `Failed to create markets in batch: ${error?.message || error}`
    );
  }
}

// Execute script and handle errors
main().catch((error: any) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
