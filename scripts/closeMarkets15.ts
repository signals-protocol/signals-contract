import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
import { WINNING_BINS, getDefaultWinningBin } from "./winningBins";

// 환경변수 로드
dotenv.config();

async function main() {
  console.log("Closing markets 0 to 14...");
  console.log("Network:", network.name);

  // 네트워크에 따라 RangeBetManager 주소 자동 설정
  let rangeBetManagerAddress = "";

  if (network.name === "localhost") {
    rangeBetManagerAddress = "0x0B306BF915C4d645ff596e518fAf3F9669b97016"; // 로컬 테스트용 주소
  } else if (network.name === "rskTestnet") {
    rangeBetManagerAddress = process.env.RSK_RANGE_BET_MANAGER || "";
  } else if (network.name === "polygonAmoy") {
    rangeBetManagerAddress = process.env.POLYGON_AMOY_RANGE_BET_MANAGER || "";
  } else if (network.name === "citreaTestnet") {
    rangeBetManagerAddress = process.env.CITREA_RANGE_BET_MANAGER || "";
  }

  // 마켓 ID 범위 고정
  const startMarketId = 0;
  const endMarketId = 14;

  // 주소 검증
  if (!rangeBetManagerAddress) {
    console.error(
      `Error: ${network.name} 네트워크의 RangeBetManager 주소가 설정되지 않았습니다.`
    );
    console.error("환경변수를 설정하거나 .env 파일을 업데이트하세요.");
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

  // 마켓 개수 확인
  const marketCount = await rangeBetManager.marketCount();
  console.log(`Total markets: ${marketCount}`);

  // 마지막으로 닫힌 마켓 ID 확인 시도
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

  // 종료 마켓 ID가 마켓 총 개수를 초과하는지 확인
  if (endMarketId >= marketCount) {
    console.log(
      `Warning: Specified endMarketId ${endMarketId} exceeds total market count ${marketCount}`
    );
    console.log(`Will close markets up to ${Number(marketCount) - 1}`);
  }

  const actualEndMarketId = Math.min(endMarketId, Number(marketCount) - 1);

  // 지정된 범위의 마켓 닫기
  for (
    let marketId = startMarketId;
    marketId <= actualEndMarketId;
    marketId++
  ) {
    try {
      // 마켓 정보 확인
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

      // winningBin 값 결정
      let winningBin: number;

      // 미리 정의된 winningBin 값이 있는지 확인
      if (marketId in WINNING_BINS) {
        winningBin = WINNING_BINS[marketId];
      } else {
        // 정의된 값이 없으면 기본값 계산
        winningBin = getDefaultWinningBin(minTick, maxTick, tickSpacing);
      }

      console.log(
        `Closing market ${marketId} with winning bin ${winningBin}...`
      );

      // 마켓 닫기 트랜잭션 제출 (marketId 인자로 전달 안함)
      const tx = await rangeBetManager.closeMarket(winningBin);
      const receipt = await tx.wait();

      console.log(`Market ${marketId} closed successfully!`);
      console.log(`Transaction Hash: ${receipt.hash}`);
      console.log(`Block Number: ${receipt.blockNumber}`);
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
