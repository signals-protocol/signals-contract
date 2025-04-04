import { expect } from "chai";
import { setupTestEnvironment } from "./setupTests";

describe("Market Creation", function () {
  let env: any;

  beforeEach(async function () {
    env = await setupTestEnvironment();
  });

  it("Should create a market with correct parameters", async function () {
    // Create a new market
    const newMarketTx = await env.rangeBetManager.createMarket(120, -720, 720);
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
  });

  it("Should fail with invalid tick parameters", async function () {
    // Try to create with minTick not a multiple of tickSpacing
    await expect(
      env.rangeBetManager.createMarket(60, -361, 360)
    ).to.be.revertedWith("Min tick must be a multiple of tick spacing");

    // Try to create with maxTick not a multiple of tickSpacing
    await expect(
      env.rangeBetManager.createMarket(60, -360, 361)
    ).to.be.revertedWith("Max tick must be a multiple of tick spacing");

    // Try to create with minTick >= maxTick
    await expect(
      env.rangeBetManager.createMarket(60, 360, 360)
    ).to.be.revertedWith("Min tick must be less than max tick");

    // Try to create with tickSpacing <= 0
    await expect(
      env.rangeBetManager.createMarket(0, -360, 360)
    ).to.be.revertedWith("Tick spacing must be positive");
  });

  it("Should only allow owner to create markets", async function () {
    await expect(
      env.rangeBetManager.connect(env.user1).createMarket(60, -360, 360)
    ).to.be.revertedWithCustomError(
      env.rangeBetManager,
      "OwnableUnauthorizedAccount"
    );
  });

  // 추가 테스트: 여러 시장 연속 생성 테스트
  it("Should create multiple markets sequentially with auto incrementing IDs", async function () {
    // Create three markets in sequence
    const marketParams = [
      { tickSpacing: 60, minTick: -360, maxTick: 360 },
      { tickSpacing: 120, minTick: -720, maxTick: 720 },
      { tickSpacing: 180, minTick: -1080, maxTick: 1080 },
    ];

    // Market 0 already created in setupTestEnvironment
    // Create market 1
    let tx = await env.rangeBetManager.createMarket(
      marketParams[1].tickSpacing,
      marketParams[1].minTick,
      marketParams[1].maxTick
    );
    await tx.wait();

    // Create market 2
    tx = await env.rangeBetManager.createMarket(
      marketParams[2].tickSpacing,
      marketParams[2].minTick,
      marketParams[2].maxTick
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
            }
          : marketParams[i];

      expect(marketInfo[2]).to.equal(params.tickSpacing); // tickSpacing
      expect(marketInfo[3]).to.equal(params.minTick); // minTick
      expect(marketInfo[4]).to.equal(params.maxTick); // maxTick
    }
  });
});
