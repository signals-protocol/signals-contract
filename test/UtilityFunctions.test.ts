import { expect } from "chai";
import { ethers } from "hardhat";
import { setupTestEnvironment } from "./setupTests";
import { Log } from "@ethersproject/abstract-provider";

describe("Utility Functions", function () {
  let env: any;

  beforeEach(async function () {
    env = await setupTestEnvironment();
  });

  describe("calculateBinCost", function () {
    // Additional test: Verify calculateBinCost - called on an inactive market
    it("Should return 0 for inactive market", async function () {
      // Make a bet first to have some state
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      // Deactivate the market
      await env.rangeBetManager.deactivateMarket(env.marketId);

      // Calculate cost should return 0
      const cost = await env.rangeBetManager.calculateBinCost(
        env.marketId,
        0,
        ethers.parseEther("100")
      );

      expect(cost).to.equal(0);
    });

    // Additional test: Verify calculateBinCost - called on a closed market
    it("Should return 0 for closed market", async function () {
      // Make a bet first to have some state
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      // Close the market
      await env.rangeBetManager.closeMarket(0);

      // Calculate cost should return 0
      const cost = await env.rangeBetManager.calculateBinCost(
        env.marketId,
        0,
        ethers.parseEther("100")
      );

      expect(cost).to.equal(0);
    });

    // Additional test: Verify calculateBinCost - called with binIndex outside range
    it("Should return 0 for out of range bin index", async function () {
      // Calculate cost for bin index outside the range
      const cost = await env.rangeBetManager.calculateBinCost(
        env.marketId,
        600, // Outside range
        ethers.parseEther("100")
      );

      expect(cost).to.equal(0);
    });

    // Additional test: Verify calculateBinCost - called with invalid binIndex
    it("Should return 0 for invalid bin index", async function () {
      // Calculate cost for bin index that's not a multiple of tickSpacing
      const cost = await env.rangeBetManager.calculateBinCost(
        env.marketId,
        61, // Not a multiple of 60
        ethers.parseEther("100")
      );

      expect(cost).to.equal(0);
    });
  });

  describe("calculateBinSellCost", function () {
    it("Should calculate sell revenue correctly in normal case", async function () {
      // 1) First buy tokens in the market
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      // 2) Now calculate sell cost
      const sellAmount = ethers.parseEther("50");
      const sellRevenue = await env.rangeBetManager.calculateBinSellCost(
        env.marketId,
        0,
        sellAmount
      );

      // 3) Verification: In q=T state, sellRevenue should equal sellAmount
      expect(sellRevenue).to.equal(sellAmount);
    });

    it("Should calculate sell costs correctly for multiple bins", async function () {
      // 1) Buy tokens in separate bins (increasing q for each bin and T overall)
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("50")],
          ethers.parseEther("100")
        );

      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [60],
          [ethers.parseEther("50")],
          ethers.parseEther("100")
        );

      // 2) Calculate sell cost for first bin
      const sellAmount1 = ethers.parseEther("25");
      const sellRevenue1 = await env.rangeBetManager.calculateBinSellCost(
        env.marketId,
        0,
        sellAmount1
      );

      // 3) Calculate sell cost for second bin
      const sellAmount2 = ethers.parseEther("25");
      const sellRevenue2 = await env.rangeBetManager.calculateBinSellCost(
        env.marketId,
        60,
        sellAmount2
      );

      // 4) In this case, each bin's q is 50, and total T is 100
      // For q < T, the sell revenue should be less than sell amount
      expect(sellRevenue1).to.be.lt(sellAmount1);
      expect(sellRevenue2).to.be.lt(sellAmount2);
    });

    it("Should revert for inactive market", async function () {
      // 1) First buy tokens in the market
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      // 2) Market deactivation
      await env.rangeBetManager.deactivateMarket(env.marketId);

      // 3) Try to calculate sell cost - expect revert
      await expect(
        env.rangeBetManager.calculateBinSellCost(
          env.marketId,
          0,
          ethers.parseEther("50")
        )
      ).to.be.revertedWith("Market is not active or closed");
    });

    it("Should revert for out of range bin index", async function () {
      // Sell cost calculation for bin index outside the range
      await expect(
        env.rangeBetManager.calculateBinSellCost(
          env.marketId,
          600, // Outside range
          ethers.parseEther("50")
        )
      ).to.be.revertedWith("Bin index out of range");
    });

    it("Should revert for invalid bin index", async function () {
      // Sell cost calculation for bin index that's not a multiple of tickSpacing
      await expect(
        env.rangeBetManager.calculateBinSellCost(
          env.marketId,
          61, // Not a multiple of 60
          ethers.parseEther("50")
        )
      ).to.be.revertedWith("Bin index must be a multiple of tick spacing");
    });

    it("Should revert when trying to sell more than available", async function () {
      // 1) First buy tokens in the market
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("50")],
          ethers.parseEther("100")
        );

      // 2) Try to sell more tokens than available
      await expect(
        env.rangeBetManager.calculateBinSellCost(
          env.marketId,
          0,
          ethers.parseEther("100") // More than available 50
        )
      ).to.be.revertedWith("Cannot sell more tokens than available in bin");
    });

    it("Should verify buy/sell symmetry with actual contract state", async function () {
      // 1) First buy
      const buyAmount = ethers.parseEther("100");
      const buyTx = await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(env.marketId, [0], [buyAmount], ethers.parseEther("150"));

      // 2) Buy cost verification (First buy, so buyAmount should be equal)
      const receipt = await buyTx.wait();
      const tokensBoughtEvent = receipt?.logs.find(
        (log: any) => log.fragment?.name === "TokensBought"
      );
      const buyCost = (tokensBoughtEvent as any).args[4]; // totalCost

      // 3) Partial sell cost calculation (50%)
      const sellAmount = buyAmount / 2n;
      const sellRevenue1 = await env.rangeBetManager.calculateBinSellCost(
        env.marketId,
        0,
        sellAmount
      );

      // 4) Remaining sell cost calculation (Remaining 50%)
      const sellRevenue2 = await env.rangeBetManager.calculateBinSellCost(
        env.marketId,
        0,
        sellAmount
      );

      // 5) Total sell revenue should be equal to buy cost (q=T case)
      const totalSellRevenue = sellRevenue1 + sellRevenue2;
      expect(totalSellRevenue).to.be.closeTo(
        buyCost,
        ethers.parseEther("0.001")
      );

      console.log(
        `Buy cost: ${ethers.formatEther(
          buyCost
        )}, Total sell revenue: ${ethers.formatEther(totalSellRevenue)}`
      );
    });

    it("Should have symmetry between buy and sell costs with existing liquidity", async function () {
      // 1) First create sufficient liquidity (other user already has position)
      await env.rangeBetManager.connect(env.user1).buyTokens(
        env.marketId,
        [0], // bin index 0
        [ethers.parseEther("1000")], // Large liquidity of 1000 tokens
        ethers.parseEther("1100") // max collateral
      );

      // 2) Now test user (user2) buys
      const buyAmount = ethers.parseEther("50"); // Buy 50 tokens
      const buyTx = await env.rangeBetManager.connect(env.user2).buyTokens(
        env.marketId,
        [0], // Same bin
        [buyAmount],
        ethers.parseEther("100") // Sufficient max collateral
      );

      // 3) Buy cost verification
      const receipt = await buyTx.wait();
      const tokensBoughtEvent = receipt?.logs.find(
        (log: any) => log.fragment?.name === "TokensBought"
      );
      const buyCost = (tokensBoughtEvent as any).args[4]; // totalCost

      // 4) Calculate sell cost for same amount
      const sellRevenue = await env.rangeBetManager.calculateBinSellCost(
        env.marketId,
        0,
        buyAmount // Same amount as bought
      );

      // 5) Buy cost and sell revenue should be close (AMM principle, not completely identical)
      // Especially in situation where liquidity already exists
      expect(sellRevenue).to.be.closeTo(buyCost, ethers.parseEther("0.0001"));

      console.log(
        `With existing liquidity - Buy cost: ${ethers.formatEther(buyCost)}, ` +
          `Sell revenue: ${ethers.formatEther(sellRevenue)}, ` +
          `Difference: ${ethers.formatEther(
            buyCost > sellRevenue
              ? buyCost - sellRevenue
              : sellRevenue - buyCost
          )}`
      );
    });
  });

  describe("Token ID Encoding/Decoding", function () {
    it("Should correctly encode and decode token IDs", async function () {
      const marketId = 1;
      const binIndex = 60;

      // Encode the token ID
      const tokenId = await env.rangeBetToken.encodeTokenId(marketId, binIndex);

      // Decode the market ID and bin index from the token ID
      const [decodedMarketId, decodedBinIndex] =
        await env.rangeBetToken.decodeTokenId(tokenId);

      // Check that the values match
      expect(decodedMarketId).to.equal(marketId);
      expect(decodedBinIndex).to.equal(binIndex);
    });

    it("Should work with negative bin indices", async function () {
      const marketId = 1;
      const binIndex = -60;

      // Encode the token ID
      const tokenId = await env.rangeBetToken.encodeTokenId(marketId, binIndex);

      // Decode the market ID and bin index from the token ID
      const [decodedMarketId, decodedBinIndex] =
        await env.rangeBetToken.decodeTokenId(tokenId);

      // Check that the values match
      expect(decodedMarketId).to.equal(marketId);
      expect(decodedBinIndex).to.equal(binIndex);
    });
  });
});
