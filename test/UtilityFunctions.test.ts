import { expect } from "chai";
import { ethers } from "hardhat";
import { setupTestEnvironment } from "./setupTests";

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
      await env.rangeBetManager.closeMarket(env.marketId, 0);

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
