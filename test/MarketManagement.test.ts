import { expect } from "chai";
import { ethers } from "hardhat";
import { setupTestEnvironment } from "./setupTests";

describe("Market Management", function () {
  let env: any;

  beforeEach(async function () {
    env = await setupTestEnvironment();
  });

  it("Should allow owner to deactivate and reactivate a market", async function () {
    // Deactivate the market
    await env.rangeBetManager.deactivateMarket(env.marketId);

    // Check market is inactive
    let marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
    expect(marketInfo[0]).to.be.false; // active = false

    // Try to buy tokens in inactive market
    await expect(
      env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        )
    ).to.be.revertedWith("Market is not active");

    // Reactivate the market
    await env.rangeBetManager.activateMarket(env.marketId);

    // Check market is active again
    marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
    expect(marketInfo[0]).to.be.true; // active = true

    // Now buying should work
    await env.rangeBetManager
      .connect(env.user1)
      .buyTokens(
        env.marketId,
        [0],
        [ethers.parseEther("100")],
        ethers.parseEther("150")
      );
  });

  // Additional test: Calling deactivateMarket on already inactive market
  it("Should allow deactivating an already inactive market (idempotent operation)", async function () {
    // First deactivation
    await env.rangeBetManager.deactivateMarket(env.marketId);

    // Check market is inactive
    let marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
    expect(marketInfo[0]).to.be.false; // active = false

    // Second deactivation
    await env.rangeBetManager.deactivateMarket(env.marketId);

    // Check market is still inactive
    marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
    expect(marketInfo[0]).to.be.false; // active = false
  });

  // Additional test: Calling activateMarket on already active market
  it("Should allow activating an already active market (idempotent operation)", async function () {
    // Market is active by default after creation
    let marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
    expect(marketInfo[0]).to.be.true; // active = true

    // Activate anyway
    await env.rangeBetManager.activateMarket(env.marketId);

    // Check market is still active
    marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
    expect(marketInfo[0]).to.be.true; // active = true
  });

  // Additional test: Attempt to activate/deactivate a closed market
  it("Should not allow activating or deactivating a closed market", async function () {
    // Close the market first
    await env.rangeBetManager.closeMarket(30); // Price 30 falls in bin 0

    // Attempt to deactivate a closed market
    await expect(
      env.rangeBetManager.deactivateMarket(env.marketId)
    ).to.be.revertedWith("Market is already closed");

    // Attempt to activate a closed market
    await expect(
      env.rangeBetManager.activateMarket(env.marketId)
    ).to.be.revertedWith("Market is already closed");
  });
});
