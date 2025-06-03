import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
import { getExpectedPrice, getMarketTrend } from "./marketTrends";

// Load environment variables
dotenv.config();

// ===== 설정 상수 =====
// 닫을 마켓의 개수를 여기서 설정하세요
const MARKETS_TO_CLOSE = 3;

async function main() {
  console.log(`Attempting to close ${MARKETS_TO_CLOSE} markets...`);
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
  } else if (network.name === "megaethTestnet") {
    rangeBetManagerAddress = process.env.MEGAETH_RANGE_BET_MANAGER || "";
  }

  // Validate address
  if (!rangeBetManagerAddress) {
    console.error(
      `Error: RangeBetManager address for ${network.name} network is not set.`
    );
    console.error("Set environment variables or update your .env file.");
    process.exit(1);
  }

  console.log(`RangeBetManager: ${rangeBetManagerAddress}`);

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

  // Get the last closed market ID to determine next market to close
  const lastClosedMarketId = await rangeBetManager.getLastClosedMarketId();

  // Check if any market has been closed (max uint256 means no markets closed yet)
  const maxUint256 = BigInt(
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  );
  const isAnyMarketClosed = lastClosedMarketId !== maxUint256;

  // Calculate next market to close
  let nextMarketToClose: number;
  if (isAnyMarketClosed) {
    nextMarketToClose = Number(lastClosedMarketId) + 1;
    console.log(`Last closed market ID: ${lastClosedMarketId}`);
  } else {
    nextMarketToClose = 0;
    console.log("Last closed market ID: None (starting from market 0)");
  }

  console.log(`Next market to close: ${nextMarketToClose}`);

  // Calculate how many markets we can actually close
  const availableMarkets = Number(marketCount) - nextMarketToClose;
  const marketsToClose = Math.min(MARKETS_TO_CLOSE, availableMarkets);

  if (marketsToClose <= 0) {
    console.log("No markets available to close!");
    return;
  }

  console.log(
    `Will close ${marketsToClose} markets (${nextMarketToClose} to ${
      nextMarketToClose + marketsToClose - 1
    })`
  );

  // Close markets sequentially
  for (let i = 0; i < marketsToClose; i++) {
    const currentMarketId = nextMarketToClose + i;
    try {
      // Check market information
      console.log(`\n=== Market ${currentMarketId} ===`);
      const marketInfo = await rangeBetManager.getMarketInfo(currentMarketId);
      const isActive = marketInfo[0];
      const isClosed = marketInfo[1];

      if (isClosed) {
        console.log(`Market ${currentMarketId} is already closed`);
        continue;
      }

      if (!isActive) {
        console.log(`Market ${currentMarketId} is not active`);
        continue;
      }

      const minTick = Number(marketInfo[3]);
      const maxTick = Number(marketInfo[4]);
      const tickSpacing = Number(marketInfo[2]);

      // 트렌드 정보 출력
      const trend = getMarketTrend(currentMarketId);
      if (trend) {
        console.log(
          `Trend: ${trend.direction} (intensity: ${trend.intensity}/10)`
        );
        console.log(`Description: ${trend.description}`);
      } else {
        console.log("No trend data available, using default calculation");
      }

      // 트렌드 데이터를 기반으로 실제 가격 가져오기
      const expectedPrice = getExpectedPrice(currentMarketId);

      // 기본값 설정 (데이터가 없는 경우)
      let actualPrice = expectedPrice;
      if (!actualPrice) {
        // 데이터가 없으면 중간값 사용
        actualPrice = Math.floor((minTick + maxTick) / 2);
        console.log("No price data available, using middle price");
      }

      console.log(
        `Market range: ${minTick} to ${maxTick} (spacing: ${tickSpacing})`
      );
      console.log(`Expected price: ${actualPrice}`);

      // Submit transaction to close market
      console.log(
        `Closing market ${currentMarketId} with price ${actualPrice}...`
      );
      const tx = await rangeBetManager.closeMarket(actualPrice);
      const receipt = await tx.wait();

      if (receipt) {
        console.log(`✅ Market ${currentMarketId} closed successfully!`);
        console.log(`Transaction Hash: ${receipt.hash}`);
        console.log(`Block Number: ${receipt.blockNumber}`);
      } else {
        console.log(
          `Market ${currentMarketId} closure transaction sent, but receipt not available`
        );
      }
    } catch (error: any) {
      console.error(
        `❌ Error closing market ${currentMarketId}:`,
        error.message
      );
    }
  }

  console.log("\n🎉 Market closing process completed.");
  console.log(`Total markets processed: ${marketsToClose}`);
}

// Execute script and handle errors
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
