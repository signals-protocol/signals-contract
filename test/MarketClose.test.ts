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
    // Close the market with price 30 (which falls in bin 0)
    await env.rangeBetManager.closeMarket(30);

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

  it("Should fail to close a market with price outside range", async function () {
    // Try to close with a price outside the market range
    // Market range is [-360, 360], so price 500 would be outside
    await expect(env.rangeBetManager.closeMarket(500)).to.be.revertedWith(
      "Price is outside market range"
    );

    // Try to close with a negative price outside the range
    await expect(env.rangeBetManager.closeMarket(-500)).to.be.revertedWith(
      "Price is outside market range"
    );
  });

  // Additional test: Attempt to close a market that is inactive (active=false) but not yet closed (closed=false)
  it("Should not allow closing an inactive market", async function () {
    // Deactivate the market
    await env.rangeBetManager.deactivateMarket(env.marketId);

    // Try to close the inactive market with price 30
    await expect(env.rangeBetManager.closeMarket(30)).to.be.revertedWith(
      "Market is not active"
    );
  });

  // Additional test: Attempt to close a market that is already closed (closed=true)
  it("Should not allow closing an already closed market", async function () {
    // Close the market first time with price 30
    await env.rangeBetManager.closeMarket(30);

    // Try to close it again with price 90
    await expect(env.rangeBetManager.closeMarket(90)).to.be.revertedWith(
      "No more markets to close"
    );
  });

  // New test: Verify getting last closed market ID
  it("Should track the last closed market ID correctly", async function () {
    // Check initial value
    const initialLastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(initialLastClosed).to.equal(ethers.MaxUint256); // max uint256 value

    // Close the market with price 30
    await env.rangeBetManager.closeMarket(30);

    // Check updated value
    const updatedLastClosed = await env.rangeBetManager.getLastClosedMarketId();
    expect(updatedLastClosed).to.equal(env.marketId);
  });
});
