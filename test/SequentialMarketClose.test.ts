import { expect } from "chai";
import { ethers } from "hardhat";
import { setupTestEnvironment } from "./setupTests";

describe("Sequential Market Close", function () {
  let env: any;

  beforeEach(async function () {
    env = await setupTestEnvironment();

    // 추가 마켓 생성
    const tx1 = await env.rangeBetManager.createMarket(
      env.tickSpacing,
      env.minTick,
      env.maxTick,
      env.closeTime
    );
    const receipt1 = await tx1.wait();
    const marketId1 = (
      receipt1?.logs.find(
        (log) => (log as any).fragment?.name === "MarketCreated"
      ) as any
    ).args[0];

    const tx2 = await env.rangeBetManager.createMarket(
      env.tickSpacing,
      env.minTick,
      env.maxTick,
      env.closeTime
    );
    const receipt2 = await tx2.wait();
    const marketId2 = (
      receipt2?.logs.find(
        (log) => (log as any).fragment?.name === "MarketCreated"
      ) as any
    ).args[0];

    // 생성된 마켓 ID 저장
    env.marketId1 = marketId1;
    env.marketId2 = marketId2;

    // 각 마켓에 기본 토큰 구매
    // 마켓 0
    await env.rangeBetManager
      .connect(env.user1)
      .buyTokens(
        env.marketId,
        [0],
        [ethers.parseEther("100")],
        ethers.parseEther("150")
      );

    // 마켓 1
    await env.rangeBetManager
      .connect(env.user2)
      .buyTokens(
        env.marketId1,
        [60],
        [ethers.parseEther("100")],
        ethers.parseEther("150")
      );

    // 마켓 2
    await env.rangeBetManager
      .connect(env.user3)
      .buyTokens(
        env.marketId2,
        [-60],
        [ethers.parseEther("100")],
        ethers.parseEther("150")
      );
  });

  it("Should close markets sequentially and track last closed market ID", async function () {
    // 초기 lastClosedMarketId 확인
    const initialLastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(initialLastClosed).to.equal(ethers.MaxUint256); // max uint256 value

    // 첫 번째 마켓 닫기 (marketId = 0)
    await env.rangeBetManager.closeMarket(0);
    let lastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(lastClosed).to.equal(0);

    // 마켓 0이 닫혔는지 확인
    let marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
    expect(marketInfo[1]).to.be.true; // closed = true

    // 두 번째 마켓 닫기 (marketId = 1)
    await env.rangeBetManager.closeMarket(60);
    lastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(lastClosed).to.equal(1);

    // 마켓 1이 닫혔는지 확인
    marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId1);
    expect(marketInfo[1]).to.be.true; // closed = true

    // 세 번째 마켓 닫기 (marketId = 2)
    await env.rangeBetManager.closeMarket(-60);
    lastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(lastClosed).to.equal(2);

    // 마켓 2가 닫혔는지 확인
    marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId2);
    expect(marketInfo[1]).to.be.true; // closed = true
  });

  it("Should enforce sequential market closing", async function () {
    // 첫 번째 마켓을 비활성화해보기
    await env.rangeBetManager.deactivateMarket(env.marketId);

    // 비활성화된 마켓을 닫으려고 시도 - 실패해야 함
    await expect(env.rangeBetManager.closeMarket(0)).to.be.revertedWith(
      "Market is not active"
    );

    // lastClosedMarketId는 여전히 초기값이어야 함
    let lastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(lastClosed).to.equal(ethers.MaxUint256);

    // 다시 활성화
    await env.rangeBetManager.activateMarket(env.marketId);

    // 첫 번째 마켓 닫기 (정상 작동)
    await env.rangeBetManager.closeMarket(0);

    // lastClosedMarketId 업데이트 확인
    lastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(lastClosed).to.equal(0);

    // 다음 마켓이 자동으로 타겟팅되는지 확인
    // 두 번째 마켓도 닫기
    await env.rangeBetManager.closeMarket(60);
    lastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(lastClosed).to.equal(1);
  });

  it("Should return appropriate error when no more markets to close", async function () {
    // 모든 마켓 닫기
    await env.rangeBetManager.closeMarket(0); // 마켓 0
    await env.rangeBetManager.closeMarket(60); // 마켓 1
    await env.rangeBetManager.closeMarket(-60); // 마켓 2

    // 더 이상 닫을 마켓이 없을 때 다시 시도 - 실패해야 함
    await expect(env.rangeBetManager.closeMarket(0)).to.be.revertedWith(
      "No more markets to close"
    );
  });

  it("Should work with batch created markets", async function () {
    // Batch로 추가 마켓 생성
    const batchTx = await env.rangeBetManager.createBatchMarkets(
      [env.tickSpacing, env.tickSpacing],
      [env.minTick, env.minTick],
      [env.maxTick, env.maxTick],
      [env.closeTime, env.closeTime]
    );

    // 현재까지 생성된 마켓 수 (0, 1, 2, 3, 4)
    const marketCount = await env.rangeBetManager.marketCount();
    expect(marketCount).to.equal(5);

    // 순차적으로 마켓 닫기
    await env.rangeBetManager.closeMarket(0); // 마켓 0
    await env.rangeBetManager.closeMarket(60); // 마켓 1
    await env.rangeBetManager.closeMarket(-60); // 마켓 2
    await env.rangeBetManager.closeMarket(0); // 마켓 3
    await env.rangeBetManager.closeMarket(60); // 마켓 4

    // 마지막으로 닫힌 마켓 ID 확인
    const lastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(lastClosed).to.equal(4);
  });
});
