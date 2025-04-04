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

  // 추가 테스트: deactivateMarket를 이미 비활성인 마켓에 또 호출
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

  // 추가 테스트: activateMarket를 이미 active인 마켓에 또 호출
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

  // 추가 테스트: 닫힌 마켓을 활성화/비활성화 시도
  it("Should not allow activating or deactivating a closed market", async function () {
    // Set up a bet to make the market interesting
    await env.rangeBetManager
      .connect(env.user1)
      .buyTokens(
        env.marketId,
        [0],
        [ethers.parseEther("100")],
        ethers.parseEther("150")
      );

    // Close the market
    await env.rangeBetManager.closeMarket(env.marketId, 0);

    // Try to deactivate closed market
    await expect(
      env.rangeBetManager.deactivateMarket(env.marketId)
    ).to.be.revertedWith("Market is already closed");

    // Try to activate closed market
    await expect(
      env.rangeBetManager.activateMarket(env.marketId)
    ).to.be.revertedWith("Market is already closed");
  });
});
