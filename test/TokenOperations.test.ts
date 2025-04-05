import { expect } from "chai";
import { ethers } from "hardhat";
import { setupTestEnvironment } from "./setupTests";

describe("Token Operations", function () {
  let env: any;

  beforeEach(async function () {
    env = await setupTestEnvironment();
  });

  describe("Token Purchase (buyTokens)", function () {
    it("Should allow users to buy tokens in a single bin", async function () {
      // Initial state
      const binIndex = 0;
      const amount = ethers.parseEther("100");
      const maxCollateral = ethers.parseEther("150");

      // Check initial balances
      const initialCollateralBalance = await env.collateralToken.balanceOf(
        env.user1.address
      );
      const initialContractBalance = await env.collateralToken.balanceOf(
        await env.rangeBetManager.getAddress()
      );

      // Buy tokens
      const tx = await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(env.marketId, [binIndex], [amount], maxCollateral);
      const receipt = await tx.wait();

      // Get the event
      const tokensBoughtEvent = receipt?.logs.find(
        (log: any) => log.fragment?.name === "TokensBought"
      );
      expect(tokensBoughtEvent).to.not.be.undefined;

      // Check the cost from event
      const cost = tokensBoughtEvent.args[4];
      expect(cost).to.be.lte(maxCollateral);

      // Check user's collateral balance
      const finalCollateralBalance = await env.collateralToken.balanceOf(
        env.user1.address
      );
      expect(initialCollateralBalance - finalCollateralBalance).to.equal(cost);

      // Check contract's collateral balance
      const finalContractBalance = await env.collateralToken.balanceOf(
        await env.rangeBetManager.getAddress()
      );
      expect(finalContractBalance - initialContractBalance).to.equal(cost);

      // Check user's token balance
      const tokenId = await env.rangeBetToken.encodeTokenId(
        env.marketId,
        binIndex
      );
      const tokenBalance = await env.rangeBetToken.balanceOf(
        env.user1.address,
        tokenId
      );
      expect(tokenBalance).to.equal(amount);

      // Check market state
      const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      expect(marketInfo[5]).to.equal(amount); // T (total supply)
      expect(marketInfo[6]).to.equal(cost); // collateralBalance

      // Check bin quantity
      const binQuantity = await env.rangeBetManager.getBinQuantity(
        env.marketId,
        binIndex
      );
      expect(binQuantity).to.equal(amount);
    });

    it("Should allow users to buy tokens in multiple bins", async function () {
      // Initial state
      const binIndices = [0, 60, -60];
      const amounts = [
        ethers.parseEther("100"),
        ethers.parseEther("50"),
        ethers.parseEther("75"),
      ];
      const maxCollateral = ethers.parseEther("300");

      // Check initial balances
      const initialCollateralBalance = await env.collateralToken.balanceOf(
        env.user1.address
      );
      const initialContractBalance = await env.collateralToken.balanceOf(
        await env.rangeBetManager.getAddress()
      );

      // Buy tokens
      const tx = await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(env.marketId, binIndices, amounts, maxCollateral);
      const receipt = await tx.wait();

      // Get the event
      const tokensBoughtEvent = receipt?.logs.find(
        (log: any) => log.fragment?.name === "TokensBought"
      );
      expect(tokensBoughtEvent).to.not.be.undefined;

      // Check the cost from event
      const cost = tokensBoughtEvent.args[4];
      expect(cost).to.be.lte(maxCollateral);

      // Check user's collateral balance
      const finalCollateralBalance = await env.collateralToken.balanceOf(
        env.user1.address
      );
      expect(initialCollateralBalance - finalCollateralBalance).to.equal(cost);

      // Check contract's collateral balance
      const finalContractBalance = await env.collateralToken.balanceOf(
        await env.rangeBetManager.getAddress()
      );
      expect(finalContractBalance - initialContractBalance).to.equal(cost);

      // Check user's token balances for each bin
      for (let i = 0; i < binIndices.length; i++) {
        const tokenId = await env.rangeBetToken.encodeTokenId(
          env.marketId,
          binIndices[i]
        );
        const tokenBalance = await env.rangeBetToken.balanceOf(
          env.user1.address,
          tokenId
        );
        expect(tokenBalance).to.equal(amounts[i]);
      }

      // Check market state
      const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      const totalAmount = amounts.reduce(
        (sum, amount) => sum + amount,
        ethers.parseEther("0")
      );
      expect(marketInfo[5]).to.equal(totalAmount); // T (total supply)
      expect(marketInfo[6]).to.equal(cost); // collateralBalance

      // Check bin quantities
      for (let i = 0; i < binIndices.length; i++) {
        const binQuantity = await env.rangeBetManager.getBinQuantity(
          env.marketId,
          binIndices[i]
        );
        expect(binQuantity).to.equal(amounts[i]);
      }
    });

    it("Should fail when market is not active", async function () {
      // Deactivate market
      await env.rangeBetManager.deactivateMarket(env.marketId);

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
    });

    it("Should fail when bin index is out of range", async function () {
      // Try with bin index beyond maxTick
      await expect(
        env.rangeBetManager.connect(env.user1).buyTokens(
          env.marketId,
          [420], // Outside the range (-360 to 360), but is a multiple of tickSpacing (60)
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        )
      ).to.be.revertedWith("Bin index out of range");
    });

    // Additional test: When user actually has insufficient ERC20 balance
    it("Should fail when user has insufficient ERC20 balance", async function () {
      // user4 has only 1 ETH balance but trying to buy tokens that cost more
      await expect(
        env.rangeBetManager
          .connect(env.user4)
          .buyTokens(
            env.marketId,
            [0],
            [ethers.parseEther("1000")],
            ethers.parseEther("1000")
          )
      ).to.be.reverted; // ERC20: transfer amount exceeds balance
    });

    // Additional test: When user has insufficient ERC20 allowance
    it("Should fail when user has insufficient ERC20 allowance", async function () {
      // user5 has approved only 10 ETH but trying to buy tokens that cost more
      await expect(
        env.rangeBetManager
          .connect(env.user5)
          .buyTokens(
            env.marketId,
            [0],
            [ethers.parseEther("100")],
            ethers.parseEther("100")
          )
      ).to.be.reverted; // ERC20: insufficient allowance
    });

    // Additional test: Check if cases with amount=0 passed to buyTokens are ignored without errors
    it("Should ignore bin indices with zero amount", async function () {
      const binIndices = [0, 60];
      const amounts = [ethers.parseEther("100"), ethers.parseEther("0")];
      const maxCollateral = ethers.parseEther("150");

      // Buy tokens
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(env.marketId, binIndices, amounts, maxCollateral);

      // Check token balance for bin 0
      const tokenId0 = await env.rangeBetToken.encodeTokenId(
        env.marketId,
        binIndices[0]
      );
      expect(
        await env.rangeBetToken.balanceOf(env.user1.address, tokenId0)
      ).to.equal(amounts[0]);

      // Check token balance for bin 60 (should be 0)
      const tokenId60 = await env.rangeBetToken.encodeTokenId(
        env.marketId,
        binIndices[1]
      );
      expect(
        await env.rangeBetToken.balanceOf(env.user1.address, tokenId60)
      ).to.equal(0);

      // Check market state
      const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      expect(marketInfo[5]).to.equal(amounts[0]); // T (total supply) should only include non-zero amounts

      // Check bin quantities
      expect(
        await env.rangeBetManager.getBinQuantity(env.marketId, binIndices[0])
      ).to.equal(amounts[0]);
      expect(
        await env.rangeBetManager.getBinQuantity(env.marketId, binIndices[1])
      ).to.equal(0);
    });
  });
});
