import { expect } from "chai";
import { ethers } from "hardhat";
import { setupTestEnvironment } from "./setupTests";

describe("Sequential Market Close", function () {
  let env: any;

  beforeEach(async function () {
    env = await setupTestEnvironment();

    // Create additional markets
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

    // Save created market IDs
    env.marketId1 = marketId1;
    env.marketId2 = marketId2;

    // Buy tokens in each market
    // Market 0
    await env.rangeBetManager
      .connect(env.user1)
      .buyTokens(
        env.marketId,
        [0],
        [ethers.parseEther("100")],
        ethers.parseEther("150")
      );

    // Market 1
    await env.rangeBetManager
      .connect(env.user2)
      .buyTokens(
        env.marketId1,
        [60],
        [ethers.parseEther("100")],
        ethers.parseEther("150")
      );

    // Market 2
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
    // Check initial lastClosedMarketId
    const initialLastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(initialLastClosed).to.equal(ethers.MaxUint256); // max uint256 value

    // Close first market (marketId = 0) with price 30 (falls in bin 0)
    await env.rangeBetManager.closeMarket(30);
    let lastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(lastClosed).to.equal(0);

    // Verify market 0 is closed
    let marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
    expect(marketInfo[1]).to.be.true; // closed = true

    // Close second market (marketId = 1) with price 90 (falls in bin 60)
    await env.rangeBetManager.closeMarket(90);
    lastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(lastClosed).to.equal(1);

    // Verify market 1 is closed
    marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId1);
    expect(marketInfo[1]).to.be.true; // closed = true

    // Close third market (marketId = 2) with price -30 (falls in bin -60)
    await env.rangeBetManager.closeMarket(-30);
    lastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(lastClosed).to.equal(2);

    // Verify market 2 is closed
    marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId2);
    expect(marketInfo[1]).to.be.true; // closed = true
  });

  it("Should enforce sequential market closing", async function () {
    // Try deactivating the first market
    await env.rangeBetManager.deactivateMarket(env.marketId);

    // Try to close deactivated market - should fail
    await expect(env.rangeBetManager.closeMarket(30)).to.be.revertedWith(
      "Market is not active"
    );

    // lastClosedMarketId should still be initial value
    let lastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(lastClosed).to.equal(ethers.MaxUint256);

    // Reactivate market
    await env.rangeBetManager.activateMarket(env.marketId);

    // Close first market (should work now) with price 30
    await env.rangeBetManager.closeMarket(30);

    // Verify lastClosedMarketId is updated
    lastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(lastClosed).to.equal(0);

    // Verify next market is automatically targeted
    // Close second market with price 90
    await env.rangeBetManager.closeMarket(90);
    lastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(lastClosed).to.equal(1);
  });

  it("Should return appropriate error when no more markets to close", async function () {
    // Close all markets
    await env.rangeBetManager.closeMarket(30); // Market 0 (price 30 -> bin 0)
    await env.rangeBetManager.closeMarket(90); // Market 1 (price 90 -> bin 60)
    await env.rangeBetManager.closeMarket(-30); // Market 2 (price -30 -> bin -60)

    // Try closing again when no more markets - should fail
    await expect(env.rangeBetManager.closeMarket(30)).to.be.revertedWith(
      "No more markets to close"
    );
  });

  it("Should work with batch created markets", async function () {
    // Create additional markets in batch
    const batchTx = await env.rangeBetManager.createBatchMarkets(
      [env.tickSpacing, env.tickSpacing],
      [env.minTick, env.minTick],
      [env.maxTick, env.maxTick],
      [env.closeTime, env.closeTime]
    );

    // Total markets created (0, 1, 2, 3, 4)
    const marketCount = await env.rangeBetManager.marketCount();
    expect(marketCount).to.equal(5);

    // Close markets sequentially
    await env.rangeBetManager.closeMarket(30); // Market 0 (price 30 -> bin 0)
    await env.rangeBetManager.closeMarket(90); // Market 1 (price 90 -> bin 60)
    await env.rangeBetManager.closeMarket(-30); // Market 2 (price -30 -> bin -60)
    await env.rangeBetManager.closeMarket(30); // Market 3 (price 30 -> bin 0)
    await env.rangeBetManager.closeMarket(90); // Market 4 (price 90 -> bin 60)

    // Verify last closed market ID
    const lastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(lastClosed).to.equal(4);
  });
});
