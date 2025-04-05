import { expect } from "chai";
import { ethers } from "hardhat";
import { setupTestEnvironment } from "./setupTests";

describe("Bin Range Query", function () {
  let env: any;

  beforeEach(async function () {
    env = await setupTestEnvironment();
  });

  describe("getBinQuantitiesInRange", function () {
    it("Should return correct quantities for a range of bins", async function () {
      // Buy tokens on the market first to create a state
      const bins = [-120, -60, 0, 60, 120];
      const amounts = bins.map(() => ethers.parseEther("100"));

      await env.rangeBetManager.connect(env.user1).buyTokens(
        env.marketId,
        bins,
        amounts,
        ethers.parseEther("500") // Sufficient collateral
      );

      // Call the range query function
      const [binIndices, quantities] =
        await env.rangeBetManager.getBinQuantitiesInRange(
          env.marketId,
          -180, // Greater than minTick
          180 // Range includes both bins with tokens and without tokens
        );

      // Should have 7 bins (-180, -120, -60, 0, 60, 120, 180)
      expect(binIndices.length).to.equal(7);
      expect(quantities.length).to.equal(7);

      // Verify actual indices
      expect(binIndices[0]).to.equal(-180);
      expect(binIndices[1]).to.equal(-120);
      expect(binIndices[2]).to.equal(-60);
      expect(binIndices[3]).to.equal(0);
      expect(binIndices[4]).to.equal(60);
      expect(binIndices[5]).to.equal(120);
      expect(binIndices[6]).to.equal(180);

      // Verify quantities
      expect(quantities[0]).to.equal(0); // No bets at -180, so 0
      expect(quantities[1]).to.equal(ethers.parseEther("100")); // -120
      expect(quantities[2]).to.equal(ethers.parseEther("100")); // -60
      expect(quantities[3]).to.equal(ethers.parseEther("100")); // 0
      expect(quantities[4]).to.equal(ethers.parseEther("100")); // 60
      expect(quantities[5]).to.equal(ethers.parseEther("100")); // 120
      expect(quantities[6]).to.equal(0); // No bets at 180, so 0
    });

    it("Should return empty arrays for a valid range with no bins", async function () {
      // Query in a market with tick spacing 60, with no bets placed yet
      const [binIndices, quantities] =
        await env.rangeBetManager.getBinQuantitiesInRange(
          env.marketId,
          -60,
          60
        );

      // Indices should be [-60, 0, 60]
      expect(binIndices.length).to.equal(3);
      expect(quantities.length).to.equal(3);

      // All quantities should be 0
      for (let i = 0; i < quantities.length; i++) {
        expect(quantities[i]).to.equal(0);
      }
    });

    it("Should correctly handle a range with a single bin", async function () {
      // Bet on a single bin
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      // Query a single bin
      const [binIndices, quantities] =
        await env.rangeBetManager.getBinQuantitiesInRange(env.marketId, 0, 0);

      // Should have only one bin
      expect(binIndices.length).to.equal(1);
      expect(quantities.length).to.equal(1);
      expect(binIndices[0]).to.equal(0);
      expect(quantities[0]).to.equal(ethers.parseEther("100"));
    });

    it("Should revert for invalid range parameters", async function () {
      // Case: toBinIndex < fromBinIndex
      await expect(
        env.rangeBetManager.getBinQuantitiesInRange(env.marketId, 60, -60)
      ).to.be.revertedWith("fromBinIndex must be <= toBinIndex");

      // Case: Out of range
      await expect(
        env.rangeBetManager.getBinQuantitiesInRange(
          env.marketId,
          -420, // Less than minTick(-360)
          0
        )
      ).to.be.revertedWith("Bin index out of range");

      await expect(
        env.rangeBetManager.getBinQuantitiesInRange(
          env.marketId,
          0,
          420 // Greater than maxTick(360)
        )
      ).to.be.revertedWith("Bin index out of range");

      // Case: Not a multiple of tickSpacing
      await expect(
        env.rangeBetManager.getBinQuantitiesInRange(
          env.marketId,
          -61, // Not a multiple of 60
          0
        )
      ).to.be.revertedWith("fromBinIndex not multiple of tickSpacing");

      await expect(
        env.rangeBetManager.getBinQuantitiesInRange(
          env.marketId,
          0,
          61 // Not a multiple of 60
        )
      ).to.be.revertedWith("toBinIndex not multiple of tickSpacing");
    });
  });

  describe("calculateXForBin", function () {
    it("Should calculate the correct amount of tokens for a given cost", async function () {
      // First, let's buy tokens to set up a market state
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      // Get the cost for buying 50 tokens in bin 0
      const amount = ethers.parseEther("50");
      const cost = await env.rangeBetManager.calculateBinCost(
        env.marketId,
        0,
        amount
      );

      // Now, calculate how many tokens we can get for that cost
      const calculatedX = await env.rangeBetManager.calculateXForBin(
        env.marketId,
        0,
        cost
      );

      // Should return approximately the same amount (with small rounding differences)
      // Due to binary search approximation and fixed-point math, we allow a small deviation
      const diff = calculatedX - amount;
      expect(Math.abs(Number(diff))).to.be.lessThan(
        Number(ethers.parseEther("0.001"))
      );
    });

    it("Should handle empty market case correctly", async function () {
      // In an empty market (T=0), the cost equals the amount
      const cost = ethers.parseEther("100");
      const calculatedX = await env.rangeBetManager.calculateXForBin(
        env.marketId,
        0,
        cost
      );

      expect(calculatedX).to.equal(cost);
    });

    it("Should handle 'q = T' case correctly", async function () {
      // When q = T, cost equals the amount
      // First buy tokens to make q = T
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      // Now the market has q = 100 at bin 0 and T = 100 total
      const cost = ethers.parseEther("50");
      const calculatedX = await env.rangeBetManager.calculateXForBin(
        env.marketId,
        0,
        cost
      );

      // For q = T, the calculation should be close to cost
      expect(calculatedX).to.be.closeTo(
        cost,
        Number(ethers.parseEther("0.001"))
      );
    });

    it("Should return 0 for inactive or closed markets", async function () {
      // Deactivate the market
      await env.rangeBetManager.deactivateMarket(env.marketId);

      // Should return 0 for inactive market
      const calculatedX = await env.rangeBetManager.calculateXForBin(
        env.marketId,
        0,
        ethers.parseEther("100")
      );

      expect(calculatedX).to.equal(0);

      // Reactivate and close the market
      await env.rangeBetManager.activateMarket(env.marketId);
      await env.rangeBetManager.closeMarket(0);

      // Should return 0 for closed market
      const calculatedX2 = await env.rangeBetManager.calculateXForBin(
        env.marketId,
        0,
        ethers.parseEther("100")
      );

      expect(calculatedX2).to.equal(0);
    });

    it("Should return 0 for invalid bin indices", async function () {
      // Out of range bin
      const calculatedX1 = await env.rangeBetManager.calculateXForBin(
        env.marketId,
        -420, // Less than minTick(-360)
        ethers.parseEther("100")
      );

      expect(calculatedX1).to.equal(0);

      // Not a multiple of tick spacing
      const calculatedX2 = await env.rangeBetManager.calculateXForBin(
        env.marketId,
        61, // Not a multiple of 60
        ethers.parseEther("100")
      );

      expect(calculatedX2).to.equal(0);
    });

    it("Should correctly calculate X for different bin states", async function () {
      // Set up market with different bin states
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [-120, 0, 120],
          [
            ethers.parseEther("50"),
            ethers.parseEther("100"),
            ethers.parseEther("150"),
          ],
          ethers.parseEther("400")
        );

      // Test for different bins
      const cost = ethers.parseEther("10");

      // Different bins will give different token amounts for the same cost
      const xForBin1 = await env.rangeBetManager.calculateXForBin(
        env.marketId,
        -120,
        cost
      );
      const xForBin2 = await env.rangeBetManager.calculateXForBin(
        env.marketId,
        0,
        cost
      );
      const xForBin3 = await env.rangeBetManager.calculateXForBin(
        env.marketId,
        120,
        cost
      );

      // The bin with higher tokens should return less for the same cost
      expect(xForBin1).to.be.gt(xForBin2);
      expect(xForBin2).to.be.gt(xForBin3);
    });
  });
});
