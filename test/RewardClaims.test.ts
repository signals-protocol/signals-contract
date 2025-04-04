import { expect } from "chai";
import { ethers } from "hardhat";
import { setupTestEnvironment } from "./setupTests";

describe("Reward Claims", function () {
  let env: any;

  beforeEach(async function () {
    env = await setupTestEnvironment();

    // Set up a market with multiple bets for testing reward claims
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

  it("Should allow users to claim rewards from winning bin", async function () {
    // Close the market and set bin 0 as winner
    await env.rangeBetManager.closeMarket(env.marketId, 0);

    // Get collateral balance before claiming
    const user1BalanceBefore = await env.collateralToken.balanceOf(
      env.user1.address
    );
    const user2BalanceBefore = await env.collateralToken.balanceOf(
      env.user2.address
    );

    // User1 claims rewards
    await env.rangeBetManager.connect(env.user1).claimReward(env.marketId, 0);

    // User2 claims rewards
    await env.rangeBetManager.connect(env.user2).claimReward(env.marketId, 0);

    // Get collateral balance after claiming
    const user1BalanceAfter = await env.collateralToken.balanceOf(
      env.user1.address
    );
    const user2BalanceAfter = await env.collateralToken.balanceOf(
      env.user2.address
    );

    // Check that rewards were received
    expect(user1BalanceAfter).to.be.gt(user1BalanceBefore);
    expect(user2BalanceAfter).to.be.gt(user2BalanceBefore);

    // Check that user1 got more rewards than user2 (100 tokens vs 50 tokens)
    const user1Reward = user1BalanceAfter - user1BalanceBefore;
    const user2Reward = user2BalanceAfter - user2BalanceBefore;
    expect(user1Reward).to.be.gt(user2Reward);

    // The ratio should be approximately 2:1 (token amount ratio)
    // We just check that user1 (with 100 tokens) gets more than user2 (with 50 tokens)
  });

  it("Should not allow claiming from non-winning bins", async function () {
    // Close the market and set bin 0 as winner
    await env.rangeBetManager.closeMarket(env.marketId, 0);

    // Try to claim from bin 60 (not winning)
    await expect(
      env.rangeBetManager.connect(env.user2).claimReward(env.marketId, 60)
    ).to.be.revertedWith("Not the winning bin");

    // Try to claim from bin -60 (not winning)
    await expect(
      env.rangeBetManager.connect(env.user3).claimReward(env.marketId, -60)
    ).to.be.revertedWith("Not the winning bin");
  });

  it("Should not allow claiming twice", async function () {
    // Close the market and set bin 0 as winner
    await env.rangeBetManager.closeMarket(env.marketId, 0);

    // User1 claims rewards first time
    await env.rangeBetManager.connect(env.user1).claimReward(env.marketId, 0);

    // Try to claim again - should revert with "No tokens to claim"
    await expect(
      env.rangeBetManager.connect(env.user1).claimReward(env.marketId, 0)
    ).to.be.revertedWith("No tokens to claim");
  });

  it("Should burn tokens after claiming", async function () {
    // Close the market and set bin 0 as winner
    await env.rangeBetManager.closeMarket(env.marketId, 0);

    // Check token balance before claiming
    const tokenId = await env.rangeBetToken.encodeTokenId(env.marketId, 0);
    expect(
      await env.rangeBetToken.balanceOf(env.user1.address, tokenId)
    ).to.equal(ethers.parseEther("100"));

    // User1 claims rewards
    await env.rangeBetManager.connect(env.user1).claimReward(env.marketId, 0);

    // Check token balance after claiming
    expect(
      await env.rangeBetToken.balanceOf(env.user1.address, tokenId)
    ).to.equal(0);
  });

  // 추가 테스트: 마켓이 닫히지 않은 상태에서 보상 청구 시도
  it("Should not allow claiming rewards from market that is not closed", async function () {
    // Try to claim from a market that is not closed
    await expect(
      env.rangeBetManager.connect(env.user1).claimReward(env.marketId, 0)
    ).to.be.revertedWith("Market is not closed");

    // Deactivate market but don't close it
    await env.rangeBetManager.deactivateMarket(env.marketId);

    // Try to claim again
    await expect(
      env.rangeBetManager.connect(env.user1).claimReward(env.marketId, 0)
    ).to.be.revertedWith("Market is not closed");
  });

  // 추가 테스트: 보유 토큰이 전혀 없는 유저가 claimReward 시도
  it("Should not allow users with no tokens to claim rewards", async function () {
    // Close the market and set bin 0 as winner
    await env.rangeBetManager.closeMarket(env.marketId, 0);

    // User4 has no tokens but tries to claim
    await expect(
      env.rangeBetManager.connect(env.user4).claimReward(env.marketId, 0)
    ).to.be.revertedWith("No tokens to claim");
  });
});
