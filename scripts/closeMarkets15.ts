import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
import { WINNING_BINS } from "./winningBins";
import { getDefaultWinningBin } from "./winningBins";

// Load environment variables
dotenv.config();

async function main() {
  console.log("Closing markets 0 to 14...");
  console.log("Network:", network.name);

  // Automatically set RangeBetManager address based on network
  let rangeBetManagerAddress = "";

  if (network.name === "localhost") {
    rangeBetManagerAddress = "0x0B306BF915C4d645ff596e518fAf3F9669b97016"; // Local test address
  } else if (network.name === "rskTestnet") {
    rangeBetManagerAddress = process.env.RSK_RANGE_BET_MANAGER || "";
  } else if (network.name === "polygonAmoy") {
    rangeBetManagerAddress = process.env.POLYGON_AMOY_RANGE_BET_MANAGER || "";
  } else if (network.name === "polygon") {
    rangeBetManagerAddress = process.env.POLYGON_RANGE_BET_MANAGER || "";
  } else if (network.name === "citreaTestnet") {
    rangeBetManagerAddress = process.env.CITREA_RANGE_BET_MANAGER || "";
  }

  // Fixed market ID range
  const startMarketId = 0;
  const endMarketId = 14;

  // Validate address
  if (!rangeBetManagerAddress) {
    console.error(
      `Error: RangeBetManager address for ${network.name} network is not set.`
    );
    console.error("Set environment variables or update your .env file.");
    process.exit(1);
  }

  console.log(`Closing markets ${startMarketId} to ${endMarketId}...`);
  console.log("RangeBetManager:", rangeBetManagerAddress);

  // Get signer
  const [owner] = await ethers.getSigners();
  console.log("Owner address:", owner.address);

  // Get contract instance
  const rangeBetManager = await ethers.getContractAt(
    "RangeBetManager",
    rangeBetManagerAddress
  );

  // Check total market count
  const marketCount = await rangeBetManager.marketCount();
  console.log(`Total markets: ${marketCount}`);

  // Try to check the last closed market ID
  try {
    const lastClosedMarketId = await rangeBetManager.getLastClosedMarketId();
    const isAnyMarketClosed = lastClosedMarketId !== BigInt(2 ** 256 - 1);
    console.log(
      `Last closed market ID: ${
        isAnyMarketClosed ? lastClosedMarketId : "None"
      }`
    );
  } catch (error) {
    console.log("Could not determine last closed market ID, continuing anyway");
  }

  // Check if the end market ID exceeds the total count
  if (endMarketId >= marketCount) {
    console.log(
      `Warning: Specified endMarketId ${endMarketId} exceeds total market count ${marketCount}`
    );
    console.log(`Will close markets up to ${Number(marketCount) - 1}`);
  }

  const actualEndMarketId = Math.min(endMarketId, Number(marketCount) - 1);

  // Close markets in the specified range
  for (
    let marketId = startMarketId;
    marketId <= actualEndMarketId;
    marketId++
  ) {
    try {
      // Check market information
      console.log(`\nChecking market ${marketId}...`);
      const marketInfo = await rangeBetManager.getMarketInfo(marketId);
      const isActive = marketInfo[0];
      const isClosed = marketInfo[1];

      if (isClosed) {
        console.log(`Market ${marketId} is already closed`);
        continue;
      }

      if (!isActive) {
        console.log(`Market ${marketId} is not active`);
        continue;
      }

      const minTick = Number(marketInfo[3]);
      const maxTick = Number(marketInfo[4]);
      const tickSpacing = Number(marketInfo[2]);

      // Determine winning bin value
      let winningBin: number;

      // Check if there's a predefined winning bin value
      if (marketId in WINNING_BINS) {
        winningBin = WINNING_BINS[marketId];
      } else {
        // Calculate default value if no predefined value exists
        winningBin = getDefaultWinningBin(minTick, maxTick, tickSpacing);
      }

      console.log(
        `Closing market ${marketId} with winning bin ${winningBin}...`
      );

      // Submit transaction to close market (don't pass marketId as an argument)
      const tx = await rangeBetManager.closeMarket(winningBin);
      const receipt = await tx.wait();

      if (receipt) {
        console.log(`Market ${marketId} closed successfully!`);
        console.log(`Transaction Hash: ${receipt.hash}`);
        console.log(`Block Number: ${receipt.blockNumber}`);
      } else {
        console.log(
          `Market ${marketId} closure transaction sent, but receipt not available`
        );
      }
    } catch (error: any) {
      console.error(`Error closing market ${marketId}:`, error.message);
    }
  }

  console.log("\nMarket closing process completed.");
}

// Execute script and handle errors
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
