import { ethers, network } from "hardhat";

async function main() {
  console.log("Creating multiple markets...");
  console.log("Network:", network.name);

  // 루트스탁 테스트넷 배포 주소 설정
  const rangeBetManagerAddress = "0x78070bF4525A5A5600Ff97220139a6F77F840A96";
  console.log("Using RangeBetManager contract:", rangeBetManagerAddress);

  // Get contract instance
  const rangeBetManager = await ethers.getContractAt(
    "RangeBetManager",
    rangeBetManagerAddress
  );

  // 샘플 마켓과 동일한 파라미터 설정
  const tickSpacing = 60;
  const minTick = -360;
  const maxTick = 120000;

  // 현재 시간 기준
  const now = Math.floor(Date.now() / 1000);
  const oneDay = 24 * 60 * 60; // 하루(초 단위)

  // 앞으로 15일, 뒤로 15일 = 총 31개 마켓 (현재 포함)
  const daysBack = 15;
  const daysFuture = 15;

  // 결과를 저장할 배열
  const createdMarkets = [];

  console.log("\n--- Creating markets ---");

  // 과거 마켓 생성 (이미 종료된 마켓들)
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

      // 생성된 마켓 ID는 마켓의 총 개수 - 1
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

  // 미래 마켓 생성
  for (let i = 1; i <= daysFuture; i++) {
    const closeTime = now + (7 + i) * oneDay; // 일주일 + i일 후 종료
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

  // 결과 요약 출력
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
