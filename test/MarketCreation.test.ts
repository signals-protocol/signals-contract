import { expect } from "chai";
import { setupTestEnvironment } from "./setupTests";

describe("Market Creation", function () {
  let env: any;

  beforeEach(async function () {
    env = await setupTestEnvironment();
  });

  it("Should create a market with correct parameters", async function () {
    // Expected market close time: current time + 7 days
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
    expect(marketInfo.active).to.be.true;
    expect(marketInfo.closed).to.be.false;
    expect(marketInfo.tickSpacing).to.equal(120);
    expect(marketInfo.minTick).to.equal(-720);
    expect(marketInfo.maxTick).to.equal(720);
    expect(marketInfo.T).to.equal(0);
    expect(marketInfo.collateralBalance).to.equal(0);
    expect(marketInfo.openTimestamp).to.not.equal(0);
    expect(marketInfo.closeTimestamp).to.equal(closeTime);
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

  // Additional test: Test creating multiple markets sequentially
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

      // Debug output
      console.log(`Market ID ${i}: `, {
        active: marketInfo[0],
        closed: marketInfo[1],
        tickSpacing: marketInfo[2],
        minTick: marketInfo[3],
        maxTick: marketInfo[4],
        T: marketInfo[5],
        collateralBalance: marketInfo[6],
        winningBin: marketInfo[7],
        openTimestamp: marketInfo[8],
        closeTimestamp: marketInfo[9],
      });

      // Markets should be active and not closed
      expect(marketInfo.active).to.be.true;
      expect(marketInfo.closed).to.be.false;

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

      expect(marketInfo.tickSpacing).to.equal(params.tickSpacing);
      expect(marketInfo.minTick).to.equal(params.minTick);
      expect(marketInfo.maxTick).to.equal(params.maxTick);
      expect(marketInfo.openTimestamp).to.not.equal(0);
      expect(marketInfo.closeTimestamp).to.equal(params.closeTime);
    }
  });

  it("Should store openTimestamp and closeTimestamp correctly", async function () {
    const closeTime = BigInt(Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60); // 2 weeks later

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
    expect(marketInfo.openTimestamp).to.equal(emittedOpenTimestamp);
    expect(marketInfo.closeTimestamp).to.equal(emittedCloseTimestamp);
  });

  it("Should create multiple markets in batch with correct parameters", async function () {
    // Expected market close times: current time + different days
    const now = Math.floor(Date.now() / 1000);
    const closeTimes = [
      BigInt(now + 7 * 24 * 60 * 60), // +7 days
      BigInt(now + 14 * 24 * 60 * 60), // +14 days
      BigInt(now + 21 * 24 * 60 * 60), // +21 days
    ];

    // Parameters for each market
    const tickSpacings = [60, 120, 180];
    const minTicks = [-360, -720, -1080];
    const maxTicks = [360, 720, 1080];

    // Create a batch of markets
    const tx = await env.rangeBetManager.createBatchMarkets(
      tickSpacings,
      minTicks,
      maxTicks,
      closeTimes
    );
    const receipt = await tx.wait();

    // Check the events
    const marketCreatedEvents = receipt?.logs.filter(
      (log: any) => log.fragment?.name === "MarketCreated"
    );

    // Should have 3 MarketCreated events
    expect(marketCreatedEvents.length).to.equal(3);

    // Get the actual market IDs from the events
    const marketIds = marketCreatedEvents.map((event: any) => event.args[0]);
    console.log("Market IDs from events:", marketIds);

    // Verify each market was created correctly
    for (let i = 0; i < 3; i++) {
      const marketInfo = await env.rangeBetManager.getMarketInfo(marketIds[i]);

      // Debug output
      console.log(`Market ID ${marketIds[i]}: `, {
        active: marketInfo[0],
        closed: marketInfo[1],
        tickSpacing: marketInfo[2],
        minTick: marketInfo[3],
        maxTick: marketInfo[4],
        T: marketInfo[5],
        collateralBalance: marketInfo[6],
        winningBin: marketInfo[7],
        openTimestamp: marketInfo[8],
        closeTimestamp: marketInfo[9],
      });

      // Check parameters
      expect(marketInfo.active).to.be.true;
      expect(marketInfo.closed).to.be.false;
      expect(marketInfo.tickSpacing).to.equal(tickSpacings[i]);
      expect(marketInfo.minTick).to.equal(minTicks[i]);
      expect(marketInfo.maxTick).to.equal(maxTicks[i]);
      expect(marketInfo.T).to.equal(0);
      expect(marketInfo.collateralBalance).to.equal(0);
      expect(marketInfo.openTimestamp).to.not.equal(0);
      expect(marketInfo.closeTimestamp).to.equal(closeTimes[i]);
    }
  });

  it("Should fail batch creation with invalid parameters", async function () {
    const now = Math.floor(Date.now() / 1000);
    const oneWeekLater = BigInt(now + 7 * 24 * 60 * 60);

    // Different array lengths
    await expect(
      env.rangeBetManager.createBatchMarkets(
        [60, 120],
        [-360, -720, -1080],
        [360, 720, 1080],
        [oneWeekLater, oneWeekLater, oneWeekLater]
      )
    ).to.be.revertedWith("Array lengths must match");

    // Invalid tick spacing (should check first element in the array)
    await expect(
      env.rangeBetManager.createBatchMarkets(
        [0, 120, 180],
        [-360, -720, -1080],
        [360, 720, 1080],
        [oneWeekLater, oneWeekLater, oneWeekLater]
      )
    ).to.be.revertedWith("Tick spacing must be positive");

    // Min tick not a multiple of tick spacing
    await expect(
      env.rangeBetManager.createBatchMarkets(
        [60, 120, 180],
        [-361, -720, -1080],
        [360, 720, 1080],
        [oneWeekLater, oneWeekLater, oneWeekLater]
      )
    ).to.be.revertedWith("Min tick must be a multiple of tick spacing");

    // Max tick not a multiple of tick spacing
    await expect(
      env.rangeBetManager.createBatchMarkets(
        [60, 120, 180],
        [-360, -720, -1080],
        [361, 720, 1080],
        [oneWeekLater, oneWeekLater, oneWeekLater]
      )
    ).to.be.revertedWith("Max tick must be a multiple of tick spacing");

    // Min tick >= max tick
    await expect(
      env.rangeBetManager.createBatchMarkets(
        [60, 120, 180],
        [-360, -720, 1080],
        [360, 720, 1080],
        [oneWeekLater, oneWeekLater, oneWeekLater]
      )
    ).to.be.revertedWith("Min tick must be less than max tick");
  });

  it("Should only allow owner to create batch markets", async function () {
    const now = Math.floor(Date.now() / 1000);
    const oneWeekLater = BigInt(now + 7 * 24 * 60 * 60);

    await expect(
      env.rangeBetManager
        .connect(env.user1)
        .createBatchMarkets([60], [-360], [360], [oneWeekLater])
    ).to.be.revertedWithCustomError(
      env.rangeBetManager,
      "OwnableUnauthorizedAccount"
    );
  });
});
