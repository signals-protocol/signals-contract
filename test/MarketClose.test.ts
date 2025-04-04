import { expect } from "chai";
import { ethers } from "hardhat";
import { setupTestEnvironment } from "./setupTests";

describe("Market Close", function () {
  let env: any;

  beforeEach(async function () {
    env = await setupTestEnvironment();

    // Set up a market with multiple bets for testing close functionality
    // User1 bets on bin 0
    await env.rangeBetManager
      .connect(env.user1)
      .buyTokens(
        env.marketId,
        [0],
        [ethers.parseEther("100")],
        ethers.parseEther("150")
      );

    // User2 bets on bin 0 and bin 60
    await env.rangeBetManager
      .connect(env.user2)
      .buyTokens(
        env.marketId,
        [0, 60],
        [ethers.parseEther("50"), ethers.parseEther("100")],
        ethers.parseEther("200")
      );

    // User3 bets on bin -60
    await env.rangeBetManager
      .connect(env.user3)
      .buyTokens(
        env.marketId,
        [-60],
        [ethers.parseEther("150")],
        ethers.parseEther("200")
      );
  });

  it("Should allow owner to close a market and set winning bin", async function () {
    // Close the market and set bin 0 as winner
    await env.rangeBetManager.closeMarket(env.marketId, 0);

    // Check market is closed
    const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
    expect(marketInfo[1]).to.be.true; // closed = true
    expect(marketInfo[7]).to.equal(0); // winningBin = 0

    // Try to buy tokens in closed market
    await expect(
      env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        )
    ).to.be.revertedWith("Market is closed");
  });

  it("Should fail to close a market with invalid winning bin", async function () {
    // Try to close with a winning bin that's not a multiple of tickSpacing
    await expect(
      env.rangeBetManager.closeMarket(env.marketId, 61)
    ).to.be.revertedWith("Winning bin must be a multiple of tick spacing");

    // Try to close with a winning bin outside the range
    await expect(
      env.rangeBetManager.closeMarket(env.marketId, 420)
    ).to.be.revertedWith("Winning bin out of range");
  });

  // 추가 테스트: 비활성(active=false)이지만 아직 closed=false인 마켓을 닫으려 할 때
  it("Should not allow closing an inactive market", async function () {
    // Deactivate the market
    await env.rangeBetManager.deactivateMarket(env.marketId);

    // Try to close the inactive market
    await expect(
      env.rangeBetManager.closeMarket(env.marketId, 0)
    ).to.be.revertedWith("Market is not active");
  });

  // 추가 테스트: 이미 closed=true인 마켓을 또 닫으려 할 때
  it("Should not allow closing an already closed market", async function () {
    // Close the market first time
    await env.rangeBetManager.closeMarket(env.marketId, 0);

    // Try to close it again
    await expect(
      env.rangeBetManager.closeMarket(env.marketId, 60)
    ).to.be.revertedWith("Market is already closed");
  });
});
