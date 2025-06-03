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

  describe("claimReward function", function () {
    it("Should allow users to claim all rewards when tokenAmount is 0", async function () {
      // Close the market with price 30 (falls in bin 0)
      await env.rangeBetManager.closeMarket(30);

      // Get collateral balance before claiming
      const user1BalanceBefore = await env.collateralToken.balanceOf(
        env.user1.address
      );
      const user2BalanceBefore = await env.collateralToken.balanceOf(
        env.user2.address
      );

      // User1 claims all rewards (tokenAmount = 0)
      await env.rangeBetManager.connect(env.user1).claimReward(env.marketId, 0);

      // User2 claims all rewards (tokenAmount = 0)
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
    });

    it("Should allow users to claim partial rewards", async function () {
      // Close the market with price 30 (falls in bin 0)
      await env.rangeBetManager.closeMarket(30);

      // Get initial balances
      const user1BalanceBefore = await env.collateralToken.balanceOf(
        env.user1.address
      );
      const tokenId = await env.rangeBetToken.encodeTokenId(env.marketId, 0);
      const tokenBalanceBefore = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );

      // User1 claims partial rewards (50 out of 100 tokens)
      const claimAmount = ethers.parseEther("50");
      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, claimAmount);

      // Get balances after claiming
      const user1BalanceAfter = await env.collateralToken.balanceOf(
        env.user1.address
      );
      const tokenBalanceAfter = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );

      // Check that rewards were received
      expect(user1BalanceAfter).to.be.gt(user1BalanceBefore);

      // Check that only partial tokens were burned
      expect(tokenBalanceAfter).to.equal(tokenBalanceBefore - claimAmount);
      expect(tokenBalanceAfter).to.equal(ethers.parseEther("50"));
    });

    it("Should allow multiple partial claims", async function () {
      // Close the market with price 30 (falls in bin 0)
      await env.rangeBetManager.closeMarket(30);

      const tokenId = await env.rangeBetToken.encodeTokenId(env.marketId, 0);
      const initialTokenBalance = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );

      // First partial claim (30 tokens)
      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, ethers.parseEther("30"));

      let tokenBalance = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );
      expect(tokenBalance).to.equal(
        initialTokenBalance - ethers.parseEther("30")
      );

      // Second partial claim (40 tokens)
      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, ethers.parseEther("40"));

      tokenBalance = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );
      expect(tokenBalance).to.equal(
        initialTokenBalance - ethers.parseEther("70")
      );

      // Third partial claim (remaining 30 tokens)
      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, ethers.parseEther("30"));

      tokenBalance = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );
      expect(tokenBalance).to.equal(0);
    });

    it("Should not allow claiming twice when using tokenAmount = 0", async function () {
      // Close the market with price 30 (falls in bin 0)
      await env.rangeBetManager.closeMarket(30);

      // User1 claims all rewards first time
      await env.rangeBetManager.connect(env.user1).claimReward(env.marketId, 0);

      // Try to claim again - should revert with "No tokens to claim"
      await expect(
        env.rangeBetManager.connect(env.user1).claimReward(env.marketId, 0)
      ).to.be.revertedWith("No tokens to claim");
    });

    it("Should burn tokens after claiming", async function () {
      // Close the market with price 30 (falls in bin 0)
      await env.rangeBetManager.closeMarket(30);

      // Check token balance before claiming
      const tokenId = await env.rangeBetToken.encodeTokenId(env.marketId, 0);
      expect(
        await env.rangeBetToken.balanceOf(env.user1.address, tokenId)
      ).to.equal(ethers.parseEther("100"));

      // User1 claims all rewards
      await env.rangeBetManager.connect(env.user1).claimReward(env.marketId, 0);

      // Check token balance after claiming
      expect(
        await env.rangeBetToken.balanceOf(env.user1.address, tokenId)
      ).to.equal(0);
    });

    it("Should not allow claiming more tokens than user has", async function () {
      // Close the market with price 30 (falls in bin 0)
      await env.rangeBetManager.closeMarket(30);

      // User1 has 100 tokens, try to claim 150
      await expect(
        env.rangeBetManager
          .connect(env.user1)
          .claimReward(env.marketId, ethers.parseEther("150"))
      ).to.be.revertedWith("Insufficient tokens to claim");
    });

    it("Should revert when market is not closed", async function () {
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

    it("Should revert when user has no tokens", async function () {
      // Close the market with price 30 (falls in bin 0)
      await env.rangeBetManager.closeMarket(30);

      // User4 has no tokens but tries to claim
      await expect(
        env.rangeBetManager.connect(env.user4).claimReward(env.marketId, 0)
      ).to.be.revertedWith("No tokens to claim");
    });

    it("Should not allow claiming when user has no winning tokens", async function () {
      // Close the market with price 90 (falls in bin 60)
      await env.rangeBetManager.closeMarket(90);

      // User1 has tokens in bin 0, but winning bin is 60
      await expect(
        env.rangeBetManager.connect(env.user1).claimReward(env.marketId, 0)
      ).to.be.revertedWith("No tokens to claim");

      // Also test with specific token amount
      await expect(
        env.rangeBetManager
          .connect(env.user1)
          .claimReward(env.marketId, ethers.parseEther("50"))
      ).to.be.revertedWith("No tokens to claim");
    });
  });

  describe("Reward calculation consistency", function () {
    it("Should have consistent partial claim calculations", async function () {
      // Close the market with price 30 (falls in bin 0)
      await env.rangeBetManager.closeMarket(30);

      // Test that claiming in parts gives the same total as claiming all at once
      // We'll use user1 for partial claims and compare with expected calculation

      const tokenId = await env.rangeBetToken.encodeTokenId(env.marketId, 0);
      const user1TokenBalance = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );

      // Get market info to calculate expected reward
      const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      const totalWinningTokens = await env.rangeBetManager.getBinQuantity(
        env.marketId,
        0
      );

      // Calculate expected total reward using totalRewardPool
      const expectedTotalReward =
        (user1TokenBalance * marketInfo.collateralBalance) / totalWinningTokens;

      const user1BalanceBefore = await env.collateralToken.balanceOf(
        env.user1.address
      );

      // Claim in three parts: 40, 30, 30 tokens (total 100)
      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, ethers.parseEther("40"));

      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, ethers.parseEther("30"));

      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, ethers.parseEther("30"));

      const user1BalanceAfter = await env.collateralToken.balanceOf(
        env.user1.address
      );
      const actualTotalReward = user1BalanceAfter - user1BalanceBefore;

      // Now with totalRewardPool, partial claims should give exact same total as full claim
      expect(Number(actualTotalReward)).to.be.closeTo(
        Number(expectedTotalReward),
        Number(ethers.parseEther("0.001"))
      );

      // Verify that finalPrice is correctly stored
      const finalMarketInfo = await env.rangeBetManager.getMarketInfo(
        env.marketId
      );
      expect(finalMarketInfo.finalPrice).to.equal(30); // The price we closed with
      expect(finalMarketInfo.winningBin).to.equal(0); // Bin 0 for price 30
    });
  });

  describe("Extreme and Complex Test Cases", function () {
    it("Should handle very small partial claims (wei-level precision)", async function () {
      // Close the market with price 30 (falls in bin 0)
      await env.rangeBetManager.closeMarket(30);

      const user1BalanceBefore = await env.collateralToken.balanceOf(
        env.user1.address
      );

      // Claim extremely small amounts (1 wei of tokens)
      await env.rangeBetManager.connect(env.user1).claimReward(env.marketId, 1);

      await env.rangeBetManager.connect(env.user1).claimReward(env.marketId, 1);

      const user1BalanceAfter = await env.collateralToken.balanceOf(
        env.user1.address
      );

      // Should receive some reward even for tiny amounts
      expect(user1BalanceAfter).to.be.gte(user1BalanceBefore);

      // Check remaining tokens
      const tokenId = await env.rangeBetToken.encodeTokenId(env.marketId, 0);
      const remainingTokens = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );
      expect(remainingTokens).to.equal(ethers.parseEther("100") - 2n);
    });

    it("Should handle maximum precision claims (all but 1 wei)", async function () {
      // Close the market with price 30 (falls in bin 0)
      await env.rangeBetManager.closeMarket(30);

      const tokenId = await env.rangeBetToken.encodeTokenId(env.marketId, 0);
      const initialTokens = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );

      const user1BalanceBefore = await env.collateralToken.balanceOf(
        env.user1.address
      );

      // Claim all but 1 wei
      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, initialTokens - 1n);

      // Then claim the last 1 wei
      await env.rangeBetManager.connect(env.user1).claimReward(env.marketId, 1);

      const user1BalanceAfter = await env.collateralToken.balanceOf(
        env.user1.address
      );
      const finalTokens = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );

      // Should have claimed all tokens
      expect(finalTokens).to.equal(0);
      expect(user1BalanceAfter).to.be.gt(user1BalanceBefore);
    });

    it("Should handle interleaved claims from multiple users", async function () {
      // Close the market with price 30 (falls in bin 0)
      await env.rangeBetManager.closeMarket(30);

      const tokenId = await env.rangeBetToken.encodeTokenId(env.marketId, 0);

      // Get initial balances
      const user1BalanceBefore = await env.collateralToken.balanceOf(
        env.user1.address
      );
      const user2BalanceBefore = await env.collateralToken.balanceOf(
        env.user2.address
      );

      const user1TokensBefore = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );
      const user2TokensBefore = await env.rangeBetToken.balanceOf(
        env.user2.address,
        tokenId
      );

      // Interleaved partial claims
      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, ethers.parseEther("25"));
      await env.rangeBetManager
        .connect(env.user2)
        .claimReward(env.marketId, ethers.parseEther("10"));
      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, ethers.parseEther("25"));
      await env.rangeBetManager
        .connect(env.user2)
        .claimReward(env.marketId, ethers.parseEther("15"));
      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, ethers.parseEther("50"));
      await env.rangeBetManager
        .connect(env.user2)
        .claimReward(env.marketId, ethers.parseEther("25"));

      // Get final balances
      const user1BalanceAfter = await env.collateralToken.balanceOf(
        env.user1.address
      );
      const user2BalanceAfter = await env.collateralToken.balanceOf(
        env.user2.address
      );

      const user1TokensAfter = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );
      const user2TokensAfter = await env.rangeBetToken.balanceOf(
        env.user2.address,
        tokenId
      );

      // Verify all tokens were claimed
      expect(user1TokensAfter).to.equal(0);
      expect(user2TokensAfter).to.equal(0);

      // Verify rewards were proportional to original token holdings
      const user1Reward = user1BalanceAfter - user1BalanceBefore;
      const user2Reward = user2BalanceAfter - user2BalanceBefore;

      // User1 had 100 tokens, User2 had 50 tokens, so ratio should be 2:1
      const ratio = Number(user1Reward) / Number(user2Reward);
      expect(ratio).to.be.closeTo(2.0, 0.01);
    });

    it("Should handle claims with rounding edge cases", async function () {
      // Create a scenario where division might cause rounding issues
      // Close the market with price 30 (falls in bin 0)
      await env.rangeBetManager.closeMarket(30);

      const tokenId = await env.rangeBetToken.encodeTokenId(env.marketId, 0);
      const totalWinningTokens = await env.rangeBetManager.getBinQuantity(
        env.marketId,
        0
      );
      const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);

      // Claim amounts that would cause rounding issues
      const claimAmount1 = ethers.parseEther("33.333333333333333333"); // 1/3 of 100
      const claimAmount2 = ethers.parseEther("33.333333333333333333"); // 1/3 of 100
      const claimAmount3 = ethers.parseEther("33.333333333333333334"); // Remaining

      const user1BalanceBefore = await env.collateralToken.balanceOf(
        env.user1.address
      );

      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, claimAmount1);
      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, claimAmount2);
      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, claimAmount3);

      const user1BalanceAfter = await env.collateralToken.balanceOf(
        env.user1.address
      );
      const finalTokens = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );

      // Should have claimed all tokens despite rounding
      expect(finalTokens).to.equal(0);
      expect(user1BalanceAfter).to.be.gt(user1BalanceBefore);
    });

    it("Should handle rapid sequential claims", async function () {
      // Close the market with price 30 (falls in bin 0)
      await env.rangeBetManager.closeMarket(30);

      const user1BalanceBefore = await env.collateralToken.balanceOf(
        env.user1.address
      );

      // Make 10 rapid sequential claims of 10 tokens each
      for (let i = 0; i < 10; i++) {
        await env.rangeBetManager
          .connect(env.user1)
          .claimReward(env.marketId, ethers.parseEther("10"));
      }

      const user1BalanceAfter = await env.collateralToken.balanceOf(
        env.user1.address
      );
      const tokenId = await env.rangeBetToken.encodeTokenId(env.marketId, 0);
      const finalTokens = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );

      // Should have claimed all 100 tokens
      expect(finalTokens).to.equal(0);
      expect(user1BalanceAfter).to.be.gt(user1BalanceBefore);
    });

    it("Should handle claims when market has very large token amounts", async function () {
      // Create a new market for this test
      const newMarketTx = await env.rangeBetManager.createMarket(
        60,
        -360,
        360,
        Math.floor(Date.now() / 1000) + 3600
      );
      await newMarketTx.wait();
      const newMarketId = 1;

      // Buy very large amounts of tokens
      const largeAmount = ethers.parseEther("1000000"); // 1 million tokens
      const largeCost = ethers.parseEther("2000000");

      // Mint large amounts to users first
      await env.collateralToken.mintTo(env.user1.address, largeCost);
      await env.collateralToken.mintTo(env.user2.address, largeCost);

      // Approve large amounts
      await env.collateralToken
        .connect(env.user1)
        .approve(env.rangeBetManager.target, largeCost);
      await env.collateralToken
        .connect(env.user2)
        .approve(env.rangeBetManager.target, largeCost);

      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(newMarketId, [0], [largeAmount], largeCost);

      await env.rangeBetManager
        .connect(env.user2)
        .buyTokens(newMarketId, [0], [largeAmount], largeCost);

      // Close market 0 first (sequential closing requirement)
      await env.rangeBetManager.closeMarket(30);
      // Close the new market (market ID 1)
      await env.rangeBetManager.closeMarket(30);

      const user1BalanceBefore = await env.collateralToken.balanceOf(
        env.user1.address
      );

      // Claim in large chunks
      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(newMarketId, ethers.parseEther("500000"));

      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(newMarketId, ethers.parseEther("500000"));

      const user1BalanceAfter = await env.collateralToken.balanceOf(
        env.user1.address
      );
      const tokenId = await env.rangeBetToken.encodeTokenId(newMarketId, 0);
      const finalTokens = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );

      expect(finalTokens).to.equal(0);
      expect(user1BalanceAfter).to.be.gt(user1BalanceBefore);
    });

    it("Should maintain precision across multiple partial claims with different users", async function () {
      // Close the market with price 30 (falls in bin 0)
      await env.rangeBetManager.closeMarket(30);

      // Record initial state
      const tokenId = await env.rangeBetToken.encodeTokenId(env.marketId, 0);
      const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      const totalWinningTokens = await env.rangeBetManager.getBinQuantity(
        env.marketId,
        0
      );

      const user1InitialTokens = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );
      const user2InitialTokens = await env.rangeBetToken.balanceOf(
        env.user2.address,
        tokenId
      );

      const user1BalanceBefore = await env.collateralToken.balanceOf(
        env.user1.address
      );
      const user2BalanceBefore = await env.collateralToken.balanceOf(
        env.user2.address
      );

      // Calculate expected rewards
      const expectedUser1Reward =
        (user1InitialTokens * marketInfo.collateralBalance) /
        totalWinningTokens;
      const expectedUser2Reward =
        (user2InitialTokens * marketInfo.collateralBalance) /
        totalWinningTokens;

      // User1 claims in 4 parts, User2 claims in 2 parts
      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, ethers.parseEther("25"));
      await env.rangeBetManager
        .connect(env.user2)
        .claimReward(env.marketId, ethers.parseEther("30"));
      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, ethers.parseEther("25"));
      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, ethers.parseEther("25"));
      await env.rangeBetManager
        .connect(env.user2)
        .claimReward(env.marketId, ethers.parseEther("20"));
      await env.rangeBetManager
        .connect(env.user1)
        .claimReward(env.marketId, ethers.parseEther("25"));

      const user1BalanceAfter = await env.collateralToken.balanceOf(
        env.user1.address
      );
      const user2BalanceAfter = await env.collateralToken.balanceOf(
        env.user2.address
      );

      const actualUser1Reward = user1BalanceAfter - user1BalanceBefore;
      const actualUser2Reward = user2BalanceAfter - user2BalanceBefore;

      // Verify precision is maintained
      expect(Number(actualUser1Reward)).to.be.closeTo(
        Number(expectedUser1Reward),
        Number(ethers.parseEther("0.001"))
      );
      expect(Number(actualUser2Reward)).to.be.closeTo(
        Number(expectedUser2Reward),
        Number(ethers.parseEther("0.001"))
      );

      // Verify all tokens were claimed
      const user1FinalTokens = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );
      const user2FinalTokens = await env.rangeBetToken.balanceOf(
        env.user2.address,
        tokenId
      );
      expect(user1FinalTokens).to.equal(0);
      expect(user2FinalTokens).to.equal(0);
    });
  });
});
