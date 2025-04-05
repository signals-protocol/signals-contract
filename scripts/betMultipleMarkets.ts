import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";

// .env 파일 로드
dotenv.config();

async function main() {
  console.log("Betting on multiple markets...");
  console.log("Network:", network.name);

  // 네트워크에 따라 주소 설정
  let rangeBetManagerAddress = "";
  let rangeBetTokenAddress = "";
  let collateralTokenAddress = "";

  if (network.name === "localhost") {
    // 로컬 배포 주소 (deploy:local 출력에서 가져온 값)
    rangeBetManagerAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
    rangeBetTokenAddress = "0x75537828f2ce51be7289709686A69CbFDbB714F1";
    collateralTokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  } else if (network.name === "rskTestnet") {
    // RSK 테스트넷의 경우 환경 변수 사용
    rangeBetManagerAddress = process.env.RSK_RANGE_BET_MANAGER || "";
    rangeBetTokenAddress = process.env.RSK_RANGE_BET_TOKEN || "";
    collateralTokenAddress = process.env.RSK_COLLATERAL_TOKEN || "";

    if (
      !rangeBetManagerAddress ||
      !rangeBetTokenAddress ||
      !collateralTokenAddress
    ) {
      console.error("RSK contract addresses are not set in the .env file");
      process.exit(1);
    }
  } else {
    // 다른 네트워크의 경우 환경 변수가 있는지 확인
    console.error(
      `Contract addresses for network '${network.name}' are not configured`
    );
    process.exit(1);
  }

  console.log("Using contract addresses:");
  console.log("Network:", network.name);
  console.log("RangeBetManager:", rangeBetManagerAddress);
  console.log("RangeBetToken:", rangeBetTokenAddress);
  console.log("CollateralToken:", collateralTokenAddress);

  // Get signers
  const signers = await ethers.getSigners();
  const owner = signers[0];
  // owner를 user로 사용 (두 번째 사용자가 없을 경우)
  const user = signers.length > 1 ? signers[1] : owner;

  console.log("\nUsing accounts:");
  console.log("Owner:", owner.address);
  console.log("User:", user.address);

  // Get contract instances using the deployed addresses
  const rangeBetManager = await ethers.getContractAt(
    "RangeBetManager",
    rangeBetManagerAddress
  );

  const rangeBetToken = await ethers.getContractAt(
    "RangeBetToken",
    rangeBetTokenAddress
  );

  const collateralToken = await ethers.getContractAt(
    "MockCollateralToken",
    collateralTokenAddress
  );

  // 사용자에게 10,000 collateral 토큰 전송
  const collateralAmount = ethers.parseEther("10000");

  // owner와 user가 다른 경우에만 전송
  if (owner.address !== user.address) {
    await collateralToken.transfer(user.address, collateralAmount);
    console.log("\n--- Transferred Collateral ---");
    console.log(
      "User Balance:",
      (await collateralToken.balanceOf(user.address)).toString()
    );
  } else {
    console.log("\n--- Using Owner as User ---");
    console.log(
      "Owner/User Balance:",
      (await collateralToken.balanceOf(owner.address)).toString()
    );
  }

  // 사용자가 RangeBetManager에 collateral 사용 승인
  await collateralToken
    .connect(user)
    .approve(await rangeBetManager.getAddress(), collateralAmount);
  console.log("Approved collateral for betting");

  // 베팅할 마켓 ID 목록
  const marketIds = [5, 10, 15, 20, 25, 30];

  // 각 마켓에 베팅
  console.log("\n--- Placing Bets ---");

  for (const marketId of marketIds) {
    try {
      // 마켓 정보 확인
      const marketInfo = await rangeBetManager.getMarketInfo(marketId);
      const active = marketInfo[0];
      const closed = marketInfo[1];
      const tickSpacing = marketInfo[2];

      // 마켓이 활성 상태인지 확인
      if (!active || closed) {
        console.log(
          `Market ${marketId} is not active or already closed. Skipping...`
        );
        continue;
      }

      // 80k~90k 사이에서 tickSpacing(60)의 배수 랜덤 선택
      // 80000 ~ 90000 구간을 tickSpacing으로 나눈 범위 내에서 랜덤 값 선택 후 다시 tickSpacing 곱하기
      const minTick = 0;
      const maxTick = 2400;

      // 구간 내 60의 배수 중 랜덤 선택
      const minBinIndex = Math.ceil(minTick / Number(tickSpacing)); // 올림
      const maxBinIndex = Math.floor(maxTick / Number(tickSpacing)); // 내림
      const randomBinIndex =
        Math.floor(Math.random() * (maxBinIndex - minBinIndex + 1)) +
        minBinIndex;
      const selectedBin = randomBinIndex * Number(tickSpacing);

      // 각 베팅에 사용할 토큰 양
      const betAmount = ethers.parseEther("10");

      // 충분한 여유를 둔 최대 담보 금액
      const maxCollateral = ethers.parseEther("20");

      console.log(
        `Betting on Market ${marketId}, Bin ${selectedBin} with ${betAmount} tokens...`
      );

      // 베팅 실행
      const tx = await rangeBetManager.connect(user).buyTokens(
        marketId,
        [selectedBin], // 선택된 bin
        [betAmount], // 10 tokens
        maxCollateral
      );

      await tx.wait();

      // 베팅 확인
      const tokenId = await rangeBetToken.encodeTokenId(marketId, selectedBin);
      const userBalance = await rangeBetToken.balanceOf(user.address, tokenId);

      console.log(
        `✅ Bet placed successfully on Market ${marketId}, Bin ${selectedBin}`
      );
      console.log(`   User Token Balance: ${userBalance}`);
    } catch (error: any) {
      console.error(
        `❌ Failed to bet on Market ${marketId}: ${error?.message || error}`
      );
    }
  }

  // 남은 담보 확인
  const remainingBalance = await collateralToken.balanceOf(user.address);
  console.log("\n--- Betting Complete ---");
  console.log(`Remaining Collateral Balance: ${remainingBalance}`);
}

// Execute script and handle errors
main().catch((error: any) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
