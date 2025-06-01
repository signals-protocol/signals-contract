import { expect } from "chai";
import { ethers } from "hardhat";
import { setupTestEnvironment } from "./setupTests";

describe("Sell Tokens Operations", function () {
  let env: any;

  beforeEach(async function () {
    env = await setupTestEnvironment();
  });

  describe("Basic functionality", function () {
    it("Should sell tokens and update state correctly", async function () {
      // Buy tokens first
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      const initialBalance = await env.collateralToken.balanceOf(
        env.user1.address
      );

      // Sell tokens
      const tx = await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("0")
        );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "TokensSold"
      );
      expect(event).to.not.be.undefined;

      // Check user received collateral
      const finalBalance = await env.collateralToken.balanceOf(
        env.user1.address
      );
      expect(finalBalance).to.be.gt(initialBalance);

      // Check token balance is zero
      const tokenId = await env.rangeBetToken.encodeTokenId(env.marketId, 0);
      expect(
        await env.rangeBetToken.balanceOf(env.user1.address, tokenId)
      ).to.equal(0);

      // Check market state
      const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      expect(marketInfo[5]).to.equal(0); // T = 0
      expect(
        await env.rangeBetManager.getBinQuantity(env.marketId, 0)
      ).to.equal(0);
    });

    it("Should handle multi-bin sells", async function () {
      const binIndices = [0, 60, -60];
      const amounts = [
        ethers.parseEther("100"),
        ethers.parseEther("50"),
        ethers.parseEther("75"),
      ];

      // Buy tokens
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(env.marketId, binIndices, amounts, ethers.parseEther("300"));

      // Sell tokens
      await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(env.marketId, binIndices, amounts, ethers.parseEther("0"));

      // Check all bins are empty
      for (const binIndex of binIndices) {
        expect(
          await env.rangeBetManager.getBinQuantity(env.marketId, binIndex)
        ).to.equal(0);
      }
    });
  });

  describe("State consistency", function () {
    it("Should restore exact state when buy-then-sell in reverse order", async function () {
      const initialMarketInfo = await env.rangeBetManager.getMarketInfo(
        env.marketId
      );
      const initialUserBalance = await env.collateralToken.balanceOf(
        env.user1.address
      );

      // Buy in order: b1, b2, b3
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [60],
          [ethers.parseEther("50")],
          ethers.parseEther("100")
        );
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [-60],
          [ethers.parseEther("75")],
          ethers.parseEther("150")
        );

      // Sell in exact reverse order: b3, b2, b1
      await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(
          env.marketId,
          [-60],
          [ethers.parseEther("75")],
          ethers.parseEther("0")
        );
      await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(
          env.marketId,
          [60],
          [ethers.parseEther("50")],
          ethers.parseEther("0")
        );
      await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("0")
        );

      // Check exact state restoration
      const finalMarketInfo = await env.rangeBetManager.getMarketInfo(
        env.marketId
      );
      const finalUserBalance = await env.collateralToken.balanceOf(
        env.user1.address
      );

      expect(finalMarketInfo[5]).to.equal(initialMarketInfo[5]); // T
      expect(finalMarketInfo[6]).to.equal(initialMarketInfo[6]); // collateralBalance
      expect(finalUserBalance).to.equal(initialUserBalance);
    });

    it("Should demonstrate path dependency with non-reverse order", async function () {
      const initialUserBalance = await env.collateralToken.balanceOf(
        env.user1.address
      );

      // Non-reverse order operations
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [60],
          [ethers.parseEther("50")],
          ethers.parseEther("100")
        );

      // Sell b1 first (not reverse order)
      await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("0")
        );
      await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(
          env.marketId,
          [60],
          [ethers.parseEther("50")],
          ethers.parseEther("0")
        );

      const finalUserBalance = await env.collateralToken.balanceOf(
        env.user1.address
      );

      // Due to path dependency, final balance may differ from initial
      console.log(
        "Path dependency difference:",
        ethers.formatEther(
          initialUserBalance > finalUserBalance
            ? initialUserBalance - finalUserBalance
            : finalUserBalance - initialUserBalance
        )
      );
    });
  });

  describe("Error conditions", function () {
    it("Should fail with insufficient token balance", async function () {
      await expect(
        env.rangeBetManager
          .connect(env.user1)
          .sellTokens(
            env.marketId,
            [0],
            [ethers.parseEther("100")],
            ethers.parseEther("0")
          )
      ).to.be.revertedWith("Insufficient token balance");
    });

    it("Should fail with revenue below minimum", async function () {
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      await expect(
        env.rangeBetManager
          .connect(env.user1)
          .sellTokens(
            env.marketId,
            [0],
            [ethers.parseEther("100")],
            ethers.parseEther("1000")
          )
      ).to.be.revertedWith("Revenue below minimum expected");
    });

    it("Should fail when market is inactive", async function () {
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      await env.rangeBetManager.deactivateMarket(env.marketId);

      await expect(
        env.rangeBetManager
          .connect(env.user1)
          .sellTokens(
            env.marketId,
            [0],
            [ethers.parseEther("100")],
            ethers.parseEther("0")
          )
      ).to.be.revertedWith("Market is not active");
    });

    it("Should fail when market is closed", async function () {
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      await env.rangeBetManager.closeMarket(0);

      await expect(
        env.rangeBetManager
          .connect(env.user1)
          .sellTokens(
            env.marketId,
            [0],
            [ethers.parseEther("100")],
            ethers.parseEther("0")
          )
      ).to.be.revertedWith("Market is closed");
    });

    it("Should fail with empty arrays", async function () {
      await expect(
        env.rangeBetManager
          .connect(env.user1)
          .sellTokens(env.marketId, [], [], ethers.parseEther("0"))
      ).to.be.revertedWith("Must sell at least one bin");
    });

    it("Should fail with mismatched array lengths", async function () {
      await expect(
        env.rangeBetManager
          .connect(env.user1)
          .sellTokens(
            env.marketId,
            [0],
            [ethers.parseEther("100"), ethers.parseEther("50")],
            ethers.parseEther("0")
          )
      ).to.be.revertedWith("Array lengths must match");
    });

    it("Should fail with invalid bin index", async function () {
      await expect(
        env.rangeBetManager
          .connect(env.user1)
          .sellTokens(
            env.marketId,
            [420],
            [ethers.parseEther("100")],
            ethers.parseEther("0")
          )
      ).to.be.revertedWith("Bin index out of range");
    });

    it("Should fail with non-multiple of tick spacing", async function () {
      await expect(
        env.rangeBetManager
          .connect(env.user1)
          .sellTokens(
            env.marketId,
            [30],
            [ethers.parseEther("100")],
            ethers.parseEther("0")
          ) // 30 is not multiple of 60
      ).to.be.revertedWith("Bin index must be a multiple of tick spacing");
    });
  });

  describe("View functions", function () {
    it("Should calculate sell cost correctly", async function () {
      // Buy tokens first
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      // Calculate sell cost for partial amount
      const sellCost = await env.rangeBetManager.calculateBinSellCost(
        env.marketId,
        0,
        ethers.parseEther("50")
      );

      expect(sellCost).to.be.gt(0);
      // The sell cost should be less than or equal to the amount being sold
      // In our formula, when q < T, the revenue is typically less than the amount
      expect(sellCost).to.be.lte(ethers.parseEther("50"));

      // Calculate sell cost for full amount
      const fullSellCost = await env.rangeBetManager.calculateBinSellCost(
        env.marketId,
        0,
        ethers.parseEther("100")
      );

      expect(fullSellCost).to.be.gt(sellCost); // Selling more should give more revenue
    });

    it("Should handle zero amount in calculateBinSellCost", async function () {
      const sellCost = await env.rangeBetManager.calculateBinSellCost(
        env.marketId,
        0,
        0
      );
      expect(sellCost).to.equal(0);
    });
  });

  describe("Multi-user scenarios", function () {
    it("Should handle multiple users selling from same bin", async function () {
      // Both users buy in same bin
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );
      await env.rangeBetManager
        .connect(env.user2)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("50")],
          ethers.parseEther("150")
        );

      // Check total supply
      let marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      expect(marketInfo[5]).to.equal(ethers.parseEther("150")); // T = 150

      // User1 sells half
      await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(
          env.marketId,
          [0],
          [ethers.parseEther("50")],
          ethers.parseEther("0")
        );

      // Check updated state
      marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      expect(marketInfo[5]).to.equal(ethers.parseEther("100")); // T = 100

      // Both users sell remaining tokens
      await env.rangeBetManager
        .connect(env.user2)
        .sellTokens(
          env.marketId,
          [0],
          [ethers.parseEther("50")],
          ethers.parseEther("0")
        );
      await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(
          env.marketId,
          [0],
          [ethers.parseEther("50")],
          ethers.parseEther("0")
        );

      // Check final state
      marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      expect(marketInfo[5]).to.equal(0); // T = 0
    });
  });

  describe("Special cases", function () {
    it("Should handle zero amounts in multi-bin sell", async function () {
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0, 60],
          [ethers.parseEther("100"), ethers.parseEther("50")],
          ethers.parseEther("200")
        );

      // Sell with one zero amount
      await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(
          env.marketId,
          [0, 60],
          [ethers.parseEther("100"), ethers.parseEther("0")],
          ethers.parseEther("0")
        );

      // Check only bin 0 was sold
      const tokenId0 = await env.rangeBetToken.encodeTokenId(env.marketId, 0);
      const tokenId60 = await env.rangeBetToken.encodeTokenId(env.marketId, 60);

      expect(
        await env.rangeBetToken.balanceOf(env.user1.address, tokenId0)
      ).to.equal(0);
      expect(
        await env.rangeBetToken.balanceOf(env.user1.address, tokenId60)
      ).to.equal(ethers.parseEther("50"));
    });
  });

  describe("Batch operations with multiple bins", function () {
    it("Should handle batch buy-then-batch sell in exact reverse order", async function () {
      const initialMarketInfo = await env.rangeBetManager.getMarketInfo(
        env.marketId
      );
      const initialUserBalance = await env.collateralToken.balanceOf(
        env.user1.address
      );

      // Batch buy multiple bins at once
      const binIndices = [0, 60, -60, 120, -120];
      const amounts = [
        ethers.parseEther("100"),
        ethers.parseEther("50"),
        ethers.parseEther("75"),
        ethers.parseEther("25"),
        ethers.parseEther("80"),
      ];

      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(env.marketId, binIndices, amounts, ethers.parseEther("500"));

      // Batch sell in exact reverse order (same bins, same amounts)
      const reverseBinIndices = [...binIndices].reverse();
      const reverseAmounts = [...amounts].reverse();

      await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(
          env.marketId,
          reverseBinIndices,
          reverseAmounts,
          ethers.parseEther("0")
        );

      // Check exact state restoration
      const finalMarketInfo = await env.rangeBetManager.getMarketInfo(
        env.marketId
      );
      const finalUserBalance = await env.collateralToken.balanceOf(
        env.user1.address
      );

      expect(finalMarketInfo[5]).to.equal(initialMarketInfo[5]); // T
      expect(finalMarketInfo[6]).to.equal(initialMarketInfo[6]); // collateralBalance
      expect(finalUserBalance).to.equal(initialUserBalance);

      // Check all bins are empty
      for (const binIndex of binIndices) {
        expect(
          await env.rangeBetManager.getBinQuantity(env.marketId, binIndex)
        ).to.equal(0);
      }
    });

    it("Should demonstrate path dependency with batch operations in different order", async function () {
      const initialUserBalance = await env.collateralToken.balanceOf(
        env.user1.address
      );

      const binIndices = [0, 60, -60];
      const amounts = [
        ethers.parseEther("100"),
        ethers.parseEther("50"),
        ethers.parseEther("75"),
      ];

      // Scenario 1: Batch buy, then batch sell in different order
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(env.marketId, binIndices, amounts, ethers.parseEther("300"));

      // Sell in different order (not reverse)
      await env.rangeBetManager.connect(env.user1).sellTokens(
        env.marketId,
        [60, 0, -60], // Different order
        [
          ethers.parseEther("50"),
          ethers.parseEther("100"),
          ethers.parseEther("75"),
        ],
        ethers.parseEther("0")
      );

      const scenario1Balance = await env.collateralToken.balanceOf(
        env.user1.address
      );

      // Reset for scenario 2
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(env.marketId, binIndices, amounts, ethers.parseEther("300"));

      // Scenario 2: Individual sells in yet another order
      await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(
          env.marketId,
          [-60],
          [ethers.parseEther("75")],
          ethers.parseEther("0")
        );
      await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("0")
        );
      await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(
          env.marketId,
          [60],
          [ethers.parseEther("50")],
          ethers.parseEther("0")
        );

      const scenario2Balance = await env.collateralToken.balanceOf(
        env.user1.address
      );

      console.log("Initial balance:", ethers.formatEther(initialUserBalance));
      console.log("Scenario 1 balance:", ethers.formatEther(scenario1Balance));
      console.log("Scenario 2 balance:", ethers.formatEther(scenario2Balance));
      console.log(
        "Difference between scenarios:",
        ethers.formatEther(
          scenario1Balance > scenario2Balance
            ? scenario1Balance - scenario2Balance
            : scenario2Balance - scenario1Balance
        )
      );
    });

    it("Should handle partial batch sells correctly", async function () {
      const binIndices = [0, 60, -60, 120];
      const buyAmounts = [
        ethers.parseEther("100"),
        ethers.parseEther("80"),
        ethers.parseEther("60"),
        ethers.parseEther("40"),
      ];

      // Buy tokens
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          binIndices,
          buyAmounts,
          ethers.parseEther("400")
        );

      // Sell partial amounts from multiple bins
      const sellAmounts = [
        ethers.parseEther("50"), // Half of bin 0
        ethers.parseEther("80"), // All of bin 60
        ethers.parseEther("30"), // Half of bin -60
        ethers.parseEther("20"), // Half of bin 120
      ];

      await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(
          env.marketId,
          binIndices,
          sellAmounts,
          ethers.parseEther("0")
        );

      // Check remaining balances
      const expectedRemaining = [
        ethers.parseEther("50"), // bin 0
        ethers.parseEther("0"), // bin 60
        ethers.parseEther("30"), // bin -60
        ethers.parseEther("20"), // bin 120
      ];

      for (let i = 0; i < binIndices.length; i++) {
        const tokenId = await env.rangeBetToken.encodeTokenId(
          env.marketId,
          binIndices[i]
        );
        const balance = await env.rangeBetToken.balanceOf(
          env.user1.address,
          tokenId
        );
        expect(balance).to.equal(expectedRemaining[i]);
      }

      // Check market state
      const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      const expectedTotalRemaining = ethers.parseEther("100"); // 50+0+30+20
      expect(marketInfo[5]).to.equal(expectedTotalRemaining);
    });

    it("Should handle interleaved batch operations with multiple users", async function () {
      const binIndices = [0, 60, -60];

      // User1 buys
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          binIndices,
          [
            ethers.parseEther("100"),
            ethers.parseEther("50"),
            ethers.parseEther("75"),
          ],
          ethers.parseEther("300")
        );

      // User2 buys in same bins
      await env.rangeBetManager
        .connect(env.user2)
        .buyTokens(
          env.marketId,
          binIndices,
          [
            ethers.parseEther("80"),
            ethers.parseEther("40"),
            ethers.parseEther("60"),
          ],
          ethers.parseEther("300")
        );

      // User1 sells partial amounts
      await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(
          env.marketId,
          [0, 60],
          [ethers.parseEther("50"), ethers.parseEther("25")],
          ethers.parseEther("0")
        );

      // User2 sells different amounts
      await env.rangeBetManager
        .connect(env.user2)
        .sellTokens(
          env.marketId,
          [-60, 0],
          [ethers.parseEther("30"), ethers.parseEther("40")],
          ethers.parseEther("0")
        );

      // Check final state consistency
      const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);

      // Calculate expected remaining tokens
      // Bin 0: 100 + 80 - 50 - 40 = 90
      // Bin 60: 50 + 40 - 25 = 65
      // Bin -60: 75 + 60 - 30 = 105
      // Total: 90 + 65 + 105 = 260
      const expectedTotal = ethers.parseEther("260");
      expect(marketInfo[5]).to.equal(expectedTotal);

      // Check individual bin quantities
      expect(
        await env.rangeBetManager.getBinQuantity(env.marketId, 0)
      ).to.equal(ethers.parseEther("90"));
      expect(
        await env.rangeBetManager.getBinQuantity(env.marketId, 60)
      ).to.equal(ethers.parseEther("65"));
      expect(
        await env.rangeBetManager.getBinQuantity(env.marketId, -60)
      ).to.equal(ethers.parseEther("105"));
    });

    it("Should handle large batch operations efficiently", async function () {
      // Create a large batch of bins
      const binIndices = [];
      const amounts = [];

      for (let i = -300; i <= 300; i += 60) {
        binIndices.push(i);
        amounts.push(ethers.parseEther("10")); // 10 tokens per bin
      }

      // Buy all at once
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          binIndices,
          amounts,
          ethers.parseEther("1000")
        );

      // Sell all at once in reverse order
      const reverseBinIndices = [...binIndices].reverse();
      const reverseAmounts = [...amounts].reverse();

      await env.rangeBetManager
        .connect(env.user1)
        .sellTokens(
          env.marketId,
          reverseBinIndices,
          reverseAmounts,
          ethers.parseEther("0")
        );

      // Check all bins are empty
      for (const binIndex of binIndices) {
        expect(
          await env.rangeBetManager.getBinQuantity(env.marketId, binIndex)
        ).to.equal(0);
      }

      // Check market is back to initial state
      const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      expect(marketInfo[5]).to.equal(0); // T = 0
    });
  });
});
