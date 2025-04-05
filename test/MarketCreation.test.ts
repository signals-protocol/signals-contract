import { expect } from "chai";
import { setupTestEnvironment } from "./setupTests";

describe("Market Creation", function () {
  let env: any;

  beforeEach(async function () {
    env = await setupTestEnvironment();
  });

  it("Should create a market with correct parameters", async function () {
    // 예상 마켓 종료 시간: 현재 시간 + 7일
    const closeTime = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);

    // Create a new market
    const newMarketTx = await env.rangeBetManager.createMarket(
      120,
      -720,
      720,
      closeTime
    );
    await newMarketTx.wait();

    // Get market info
    const marketInfo = await env.rangeBetManager.getMarketInfo(1); // Market ID 1 (second market)

    // Check parameters
    expect(marketInfo[0]).to.be.true; // active
    expect(marketInfo[1]).to.be.false; // closed
    expect(marketInfo[2]).to.equal(120); // tickSpacing
    expect(marketInfo[3]).to.equal(-720); // minTick
    expect(marketInfo[4]).to.equal(720); // maxTick
    expect(marketInfo[5]).to.equal(0); // T (total supply)
    expect(marketInfo[6]).to.equal(0); // collateralBalance
    expect(marketInfo[8]).to.not.equal(0); // openTimestamp should not be 0
    expect(marketInfo[9]).to.equal(closeTime); // closeTimestamp
  });

  it("Should fail with invalid tick parameters", async function () {
    const closeTime = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);

    // Try to create with minTick not a multiple of tickSpacing
    await expect(
      env.rangeBetManager.createMarket(60, -361, 360, closeTime)
    ).to.be.revertedWith("Min tick must be a multiple of tick spacing");

    // Try to create with maxTick not a multiple of tickSpacing
    await expect(
      env.rangeBetManager.createMarket(60, -360, 361, closeTime)
    ).to.be.revertedWith("Max tick must be a multiple of tick spacing");

    // Try to create with minTick >= maxTick
    await expect(
      env.rangeBetManager.createMarket(60, 360, 360, closeTime)
    ).to.be.revertedWith("Min tick must be less than max tick");

    // Try to create with tickSpacing <= 0
    await expect(
      env.rangeBetManager.createMarket(0, -360, 360, closeTime)
    ).to.be.revertedWith("Tick spacing must be positive");
  });

  it("Should only allow owner to create markets", async function () {
    const closeTime = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);

    await expect(
      env.rangeBetManager
        .connect(env.user1)
        .createMarket(60, -360, 360, closeTime)
    ).to.be.revertedWithCustomError(
      env.rangeBetManager,
      "OwnableUnauthorizedAccount"
    );
  });

  // 추가 테스트: 여러 시장 연속 생성 테스트
  it("Should create multiple markets sequentially with auto incrementing IDs", async function () {
    const closeTime = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);

    // Create three markets in sequence
    const marketParams = [
      {
        tickSpacing: 60,
        minTick: -360,
        maxTick: 360,
        closeTime: env.closeTime,
      },
      { tickSpacing: 120, minTick: -720, maxTick: 720, closeTime },
      { tickSpacing: 180, minTick: -1080, maxTick: 1080, closeTime },
    ];

    // Market 0 already created in setupTestEnvironment
    // Create market 1
    let tx = await env.rangeBetManager.createMarket(
      marketParams[1].tickSpacing,
      marketParams[1].minTick,
      marketParams[1].maxTick,
      marketParams[1].closeTime
    );
    await tx.wait();

    // Create market 2
    tx = await env.rangeBetManager.createMarket(
      marketParams[2].tickSpacing,
      marketParams[2].minTick,
      marketParams[2].maxTick,
      marketParams[2].closeTime
    );
    await tx.wait();

    // Check all markets
    for (let i = 0; i < 3; i++) {
      const marketInfo = await env.rangeBetManager.getMarketInfo(i);

      // Markets should be active and not closed
      expect(marketInfo[0]).to.be.true; // active
      expect(marketInfo[1]).to.be.false; // closed

      // Check parameters match what we set
      const params =
        i === 0
          ? {
              tickSpacing: env.tickSpacing,
              minTick: env.minTick,
              maxTick: env.maxTick,
              closeTime: env.closeTime,
            }
          : marketParams[i];

      expect(marketInfo[2]).to.equal(params.tickSpacing); // tickSpacing
      expect(marketInfo[3]).to.equal(params.minTick); // minTick
      expect(marketInfo[4]).to.equal(params.maxTick); // maxTick
      expect(marketInfo[8]).to.not.equal(0); // openTimestamp should not be 0
      expect(marketInfo[9]).to.equal(params.closeTime); // closeTimestamp
    }
  });

  it("Should store openTimestamp and closeTimestamp correctly", async function () {
    const closeTime = BigInt(Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60); // 2주 후

    const tx = await env.rangeBetManager.createMarket(60, -540, 540, closeTime);
    const receipt = await tx.wait();

    // Get event data
    const marketCreatedEvent = receipt?.logs.find(
      (log: any) => log.fragment?.name === "MarketCreated"
    );
    const marketId = marketCreatedEvent.args[0];
    const emittedOpenTimestamp = marketCreatedEvent.args[4];
    const emittedCloseTimestamp = marketCreatedEvent.args[5];

    // Get market info
    const marketInfo = await env.rangeBetManager.getMarketInfo(marketId);

    // Verify timestamps
    expect(emittedOpenTimestamp).to.not.equal(0);
    expect(emittedCloseTimestamp).to.equal(closeTime);
    expect(marketInfo[8]).to.equal(emittedOpenTimestamp); // openTimestamp
    expect(marketInfo[9]).to.equal(emittedCloseTimestamp); // closeTimestamp
  });
});
