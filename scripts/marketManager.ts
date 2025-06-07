import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
import axios from "axios";

// Load environment variables
dotenv.config();

// ===== 설정 상수 =====
const MARKET_DURATION_DAYS = 14; // 마켓 지속 기간 (14일)
const TICK_SPACING = 500;
const MIN_TICK = 70000;
const MAX_TICK = 130000;

// CoinMarketCap API 설정
const CMC_API_KEY = "49901a5f-859e-4f74-9cf6-4e12399cc868";
const CMC_BASE_URL = "https://pro-api.coinmarketcap.com";
const BITCOIN_CMC_ID = 1; // Bitcoin의 CoinMarketCap ID

/**
 * 네트워크별 RangeBetManager 주소를 가져오는 함수
 */
function getRangeBetManagerAddress(): string {
  let rangeBetManagerAddress = "";

  if (network.name === "localhost") {
    rangeBetManagerAddress = "0x0B306BF915C4d645ff596e518fAf3F9669b97016";
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

  if (!rangeBetManagerAddress) {
    throw new Error(
      `RangeBetManager address for ${network.name} network is not set.`
    );
  }

  return rangeBetManagerAddress;
}

/**
 * CoinMarketCap API에서 비트코인의 UTC 자정 종가를 가져오는 함수
 * @param closeTime - 마켓 종료 시간 (Unix timestamp)
 * @returns 비트코인 종가 (USD)
 */
async function getBitcoinClosePrice(closeTime: number): Promise<number> {
  if (!CMC_API_KEY) {
    throw new Error(
      "COINMARKETCAP_API_KEY is not set in environment variables"
    );
  }

  // closeTime을 날짜로 변환
  const closeDate = new Date(closeTime * 1000);

  // 마켓 종료 시점에서 사용할 수 있는 가장 최신 종가는 전날의 종가
  // 예: 마켓이 2024-01-15 00:00에 종료되면, 2024-01-14의 종가를 사용
  const targetDate = new Date(closeDate);
  targetDate.setUTCDate(targetDate.getUTCDate() - 1);
  const targetDateString = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD 형식

  // time_start는 exclusive이므로 target date의 하루 전을 사용
  const timeStartDate = new Date(targetDate);
  timeStartDate.setUTCDate(timeStartDate.getUTCDate() - 1);
  const timeStartString = timeStartDate.toISOString().split("T")[0];

  console.log(`Market closes at: ${closeDate.toISOString()}`);
  console.log(
    `Fetching Bitcoin close price for: ${targetDateString} (using time_start: ${timeStartString})`
  );

  try {
    const response = await axios.get(
      `${CMC_BASE_URL}/v2/cryptocurrency/ohlcv/historical`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": CMC_API_KEY,
          Accept: "application/json",
        },
        params: {
          id: BITCOIN_CMC_ID,
          time_period: "daily", // daily OHLCV 데이터
          time_start: timeStartString, // exclusive이므로 하루 전
          time_end: targetDateString, // inclusive이므로 원하는 날짜
          count: 1,
        },
      }
    );

    const data = response.data;
    if (data.status.error_code !== 0) {
      throw new Error(`CoinMarketCap API error: ${data.status.error_message}`);
    }

    // V2 API 응답 구조: data.quotes 배열에 OHLCV 데이터가 있음
    const quotes = data.data.quotes;
    if (!quotes || quotes.length === 0) {
      throw new Error(`No price data found for date: ${targetDateString}`);
    }

    // 가장 최근 데이터 (우리가 원하는 날짜)의 종가
    const latestQuote = quotes[quotes.length - 1];
    const closePrice = latestQuote.quote.USD.close;
    const quoteDate = latestQuote.time_close.split("T")[0];

    console.log(`Bitcoin close price for ${quoteDate}: $${closePrice}`);

    // 날짜가 맞는지 확인
    if (quoteDate !== targetDateString) {
      console.warn(
        `Warning: Expected date ${targetDateString} but got ${quoteDate}`
      );
    }

    return Math.round(closePrice); // 정수로 반올림
  } catch (error: any) {
    console.error("Error fetching Bitcoin price:", error.message);
    throw error;
  }
}

/**
 * 현재 활성 마켓을 중지하고 새로운 마켓을 생성하는 함수
 * UTC+0 자정에 실행되어야 함
 */
export async function deactivateAndCreateMarket(): Promise<void> {
  console.log("=== Market Deactivation and Creation Process ===");
  console.log("Network:", network.name);
  console.log("Timestamp:", new Date().toISOString());

  try {
    const rangeBetManagerAddress = getRangeBetManagerAddress();
    console.log(`RangeBetManager: ${rangeBetManagerAddress}`);

    // Get signer
    const [owner] = await ethers.getSigners();
    console.log("Owner address:", owner.address);

    // Get contract instance
    const rangeBetManager = await ethers.getContractAt(
      "RangeBetManager",
      rangeBetManagerAddress
    );

    // 현재 마켓 수 확인
    const marketCount = await rangeBetManager.marketCount();
    console.log(`Total markets: ${marketCount}`);

    // 마지막으로 닫힌 마켓 ID 확인
    const lastClosedMarketId = await rangeBetManager.getLastClosedMarketId();
    const maxUint256 = BigInt(
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    );
    const isAnyMarketClosed = lastClosedMarketId !== maxUint256;

    // 다음에 닫을 마켓 계산
    let nextMarketToClose: number;
    if (isAnyMarketClosed) {
      nextMarketToClose = Number(lastClosedMarketId) + 1;
    } else {
      nextMarketToClose = 0;
    }

    console.log(`Next market to close: ${nextMarketToClose}`);

    // 현재 활성 마켓이 있는지 확인하고 중지
    if (nextMarketToClose < Number(marketCount)) {
      const marketInfo = await rangeBetManager.getMarketInfo(nextMarketToClose);
      const isActive = marketInfo[0];
      const isClosed = marketInfo[1];

      if (isActive && !isClosed) {
        console.log(`Deactivating market ${nextMarketToClose}...`);
        const deactivateTx = await rangeBetManager.deactivateMarket(
          nextMarketToClose
        );
        await deactivateTx.wait();
        console.log(`✅ Market ${nextMarketToClose} deactivated successfully`);
      } else {
        console.log(
          `Market ${nextMarketToClose} is already inactive or closed`
        );
      }
    }

    // 새로운 마켓 생성 (가장 늦게 생성된 마켓의 마감시간 + 1일)
    let newMarketCloseTime: number;

    if (Number(marketCount) > 0) {
      // 가장 마지막 마켓의 정보 가져오기
      const lastMarketId = Number(marketCount) - 1;
      const lastMarketInfo = await rangeBetManager.getMarketInfo(lastMarketId);
      const lastMarketCloseTime = Number(lastMarketInfo[10]); // closeTimestamp는 인덱스 10

      // 마지막 마켓 마감시간 + 1일
      newMarketCloseTime = lastMarketCloseTime + 24 * 60 * 60;

      console.log(
        `Last market (${lastMarketId}) close time: ${new Date(
          lastMarketCloseTime * 1000
        ).toISOString()}`
      );
    } else {
      // 첫 번째 마켓인 경우 현재 시간 기준으로 14일 후 23:59:59
      const now = new Date();
      const futureDate = new Date(now);
      futureDate.setUTCDate(futureDate.getUTCDate() + MARKET_DURATION_DAYS);
      futureDate.setUTCHours(23, 59, 59, 999);
      newMarketCloseTime = Math.floor(futureDate.getTime() / 1000);
    }

    const newMarketDate = new Date(newMarketCloseTime * 1000);
    console.log(
      `Creating new market with close time: ${newMarketDate.toISOString()}`
    );

    const createTx = await rangeBetManager.createMarket(
      TICK_SPACING,
      MIN_TICK,
      MAX_TICK,
      newMarketCloseTime
    );
    const receipt = await createTx.wait();

    if (receipt) {
      console.log(`✅ New market created successfully!`);
      console.log(`Transaction Hash: ${receipt.hash}`);
      console.log(`Block Number: ${receipt.blockNumber}`);

      // 새로 생성된 마켓 ID 확인
      const newMarketCount = await rangeBetManager.marketCount();
      console.log(`New market ID: ${Number(newMarketCount) - 1}`);
    }

    console.log("🎉 Market deactivation and creation process completed.");
  } catch (error: any) {
    console.error("❌ Error in deactivateAndCreateMarket:", error.message);
    throw error;
  }
}

/**
 * 중지된 마켓을 활성화하고 CoinMarketCap 가격으로 종료하는 함수
 * UTC+0 자정 15분 후에 실행되어야 함
 */
export async function activateAndCloseMarket(): Promise<void> {
  console.log("=== Market Activation and Closure Process ===");
  console.log("Network:", network.name);
  console.log("Timestamp:", new Date().toISOString());

  try {
    const rangeBetManagerAddress = getRangeBetManagerAddress();
    console.log(`RangeBetManager: ${rangeBetManagerAddress}`);

    // Get signer
    const [owner] = await ethers.getSigners();
    console.log("Owner address:", owner.address);

    // Get contract instance
    const rangeBetManager = await ethers.getContractAt(
      "RangeBetManager",
      rangeBetManagerAddress
    );

    // 마지막으로 닫힌 마켓 ID 확인
    const lastClosedMarketId = await rangeBetManager.getLastClosedMarketId();
    const maxUint256 = BigInt(
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    );
    const isAnyMarketClosed = lastClosedMarketId !== maxUint256;

    // 다음에 닫을 마켓 계산
    let nextMarketToClose: number;
    if (isAnyMarketClosed) {
      nextMarketToClose = Number(lastClosedMarketId) + 1;
    } else {
      nextMarketToClose = 0;
    }

    console.log(`Market to close: ${nextMarketToClose}`);

    // 마켓 정보 확인
    const marketInfo = await rangeBetManager.getMarketInfo(nextMarketToClose);
    const isActive = marketInfo[0];
    const isClosed = marketInfo[1];
    const marketCloseTime = Number(marketInfo[10]); // closeTimestamp는 인덱스 10

    if (isClosed) {
      console.log(`Market ${nextMarketToClose} is already closed`);
      return;
    }



    // 마켓의 closeTime을 사용해서 해당 날짜의 비트코인 가격 가져오기
    const marketCloseDate = new Date(marketCloseTime * 1000);
    console.log(
      `Market ${nextMarketToClose} close time: ${marketCloseDate.toISOString()}`
    );
    console.log(`Fetching Bitcoin close price for market close time...`);

    // CoinMarketCap에서 비트코인 종가 가져오기
    const closePrice = await getBitcoinClosePrice(marketCloseTime);

    console.log(
      `Closing market ${nextMarketToClose} with price: ${closePrice}`
    );

    // 마켓 종료
    const closeTx = await rangeBetManager.closeMarket(closePrice);
    const receipt = await closeTx.wait();

    if (receipt) {
      console.log(`✅ Market ${nextMarketToClose} closed successfully!`);
      console.log(`Transaction Hash: ${receipt.hash}`);
      console.log(`Block Number: ${receipt.blockNumber}`);
      console.log(`Close Price: ${closePrice}`);
    }

    console.log("🎉 Market activation and closure process completed.");
  } catch (error: any) {
    console.error("❌ Error in activateAndCloseMarket:", error.message);
    throw error;
  }
}

// CLI에서 직접 실행할 수 있도록 하는 부분
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || process.env.COMMAND;

  if (command === "deactivate-and-create") {
    await deactivateAndCreateMarket();
  } else if (command === "activate-and-close") {
    await activateAndCloseMarket();
  } else {
    console.log("Usage:");
    console.log(
      "  COMMAND=deactivate-and-create yarn hardhat run scripts/marketManager.ts --network <network>"
    );
    console.log(
      "  COMMAND=activate-and-close yarn hardhat run scripts/marketManager.ts --network <network>"
    );
    console.log("  Or:");
    console.log(
      "  yarn hardhat run scripts/marketManager.ts --network <network> -- deactivate-and-create"
    );
    console.log(
      "  yarn hardhat run scripts/marketManager.ts --network <network> -- activate-and-close"
    );
    process.exit(1);
  }
}

// CLI에서 실행된 경우에만 main 함수 실행
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
