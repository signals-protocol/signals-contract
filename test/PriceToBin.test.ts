import { expect } from "chai";
import { ethers } from "hardhat";
import { setupTestEnvironment } from "./setupTests";

describe("Price to Bin Index Conversion", function () {
  let env: any;

  beforeEach(async function () {
    env = await setupTestEnvironment();
  });

  describe("priceToBinIndex function", function () {
    it("Should correctly convert positive prices to bin indices", async function () {
      // Test with tickSpacing = 60
      expect(await env.rangeBetManager.priceToBinIndex(0, 60)).to.equal(0);
      expect(await env.rangeBetManager.priceToBinIndex(30, 60)).to.equal(0);
      expect(await env.rangeBetManager.priceToBinIndex(59, 60)).to.equal(0);
      expect(await env.rangeBetManager.priceToBinIndex(60, 60)).to.equal(60);
      expect(await env.rangeBetManager.priceToBinIndex(90, 60)).to.equal(60);
      expect(await env.rangeBetManager.priceToBinIndex(119, 60)).to.equal(60);
      expect(await env.rangeBetManager.priceToBinIndex(120, 60)).to.equal(120);
    });

    it("Should correctly convert negative prices to bin indices", async function () {
      // Test with tickSpacing = 60
      expect(await env.rangeBetManager.priceToBinIndex(-1, 60)).to.equal(-60);
      expect(await env.rangeBetManager.priceToBinIndex(-30, 60)).to.equal(-60);
      expect(await env.rangeBetManager.priceToBinIndex(-59, 60)).to.equal(-60);
      expect(await env.rangeBetManager.priceToBinIndex(-60, 60)).to.equal(-60);
      expect(await env.rangeBetManager.priceToBinIndex(-61, 60)).to.equal(-120);
      expect(await env.rangeBetManager.priceToBinIndex(-90, 60)).to.equal(-120);
      expect(await env.rangeBetManager.priceToBinIndex(-120, 60)).to.equal(
        -120
      );
      expect(await env.rangeBetManager.priceToBinIndex(-121, 60)).to.equal(
        -180
      );
    });

    it("Should work with different tick spacings", async function () {
      // Test with tickSpacing = 120
      expect(await env.rangeBetManager.priceToBinIndex(0, 120)).to.equal(0);
      expect(await env.rangeBetManager.priceToBinIndex(119, 120)).to.equal(0);
      expect(await env.rangeBetManager.priceToBinIndex(120, 120)).to.equal(120);
      expect(await env.rangeBetManager.priceToBinIndex(239, 120)).to.equal(120);
      expect(await env.rangeBetManager.priceToBinIndex(240, 120)).to.equal(240);

      // Negative values
      expect(await env.rangeBetManager.priceToBinIndex(-1, 120)).to.equal(-120);
      expect(await env.rangeBetManager.priceToBinIndex(-120, 120)).to.equal(
        -120
      );
      expect(await env.rangeBetManager.priceToBinIndex(-121, 120)).to.equal(
        -240
      );

      // Test with tickSpacing = 1
      expect(await env.rangeBetManager.priceToBinIndex(5, 1)).to.equal(5);
      expect(await env.rangeBetManager.priceToBinIndex(-5, 1)).to.equal(-5);
    });

    it("Should handle edge cases correctly", async function () {
      // Test with very large numbers
      const largePositive = 1000000;
      const largeNegative = -1000000;
      const tickSpacing = 60;

      const expectedPositive =
        Math.floor(largePositive / tickSpacing) * tickSpacing;
      const expectedNegative =
        Math.floor(largeNegative / tickSpacing) * tickSpacing;

      expect(
        await env.rangeBetManager.priceToBinIndex(largePositive, tickSpacing)
      ).to.equal(expectedPositive);
      expect(
        await env.rangeBetManager.priceToBinIndex(largeNegative, tickSpacing)
      ).to.equal(expectedNegative);
    });
  });

  describe("closeMarket with actual price", function () {
    beforeEach(async function () {
      // Add some bets to the market
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0, 60, -60],
          [
            ethers.parseEther("100"),
            ethers.parseEther("50"),
            ethers.parseEther("75"),
          ],
          ethers.parseEther("300")
        );
    });

    it("Should close market with price that falls in bin 0", async function () {
      // Price 30 should fall in bin 0 (range [0, 60))
      await env.rangeBetManager.closeMarket(30);

      const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      expect(marketInfo[1]).to.be.true; // closed = true
      expect(marketInfo[7]).to.equal(0); // winningBin = 0
    });

    it("Should close market with price that falls in bin 60", async function () {
      // Price 90 should fall in bin 60 (range [60, 120))
      await env.rangeBetManager.closeMarket(90);

      const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      expect(marketInfo[1]).to.be.true; // closed = true
      expect(marketInfo[7]).to.equal(60); // winningBin = 60
    });

    it("Should close market with price that falls in bin -60", async function () {
      // Price -30 should fall in bin -60 (range [-60, 0))
      await env.rangeBetManager.closeMarket(-30);

      const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      expect(marketInfo[1]).to.be.true; // closed = true
      expect(marketInfo[7]).to.equal(-60); // winningBin = -60
    });

    it("Should close market with exact bin boundary prices", async function () {
      // Price exactly at bin boundary should go to that bin
      await env.rangeBetManager.closeMarket(60);

      const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      expect(marketInfo[1]).to.be.true; // closed = true
      expect(marketInfo[7]).to.equal(60); // winningBin = 60
    });

    it("Should reject price outside market range", async function () {
      // Market range is [-360, 360] with tickSpacing 60
      // Price 500 would be in bin 480, which is outside the range
      await expect(env.rangeBetManager.closeMarket(500)).to.be.revertedWith(
        "Price is outside market range"
      );

      // Price -500 would be in bin -540, which is outside the range
      await expect(env.rangeBetManager.closeMarket(-500)).to.be.revertedWith(
        "Price is outside market range"
      );
    });

    it("Should handle prices at market boundaries correctly", async function () {
      // Price at max boundary (360) should be in bin 360
      await env.rangeBetManager.closeMarket(360);

      let marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      expect(marketInfo[1]).to.be.true; // closed = true
      expect(marketInfo[7]).to.equal(360); // winningBin = 360

      // Create another market to test min boundary
      const newMarketTx = await env.rangeBetManager.createMarket(
        60,
        -360,
        360,
        Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
      );
      await newMarketTx.wait();

      // Price at min boundary (-360) should be in bin -360
      await env.rangeBetManager.closeMarket(-360);

      marketInfo = await env.rangeBetManager.getMarketInfo(1); // Second market
      expect(marketInfo[1]).to.be.true; // closed = true
      expect(marketInfo[7]).to.equal(-360); // winningBin = -360
    });
  });
});
