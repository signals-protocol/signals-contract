import { expect } from "chai";
import { ethers } from "hardhat";
import { setupTestEnvironment } from "./setupTests";

describe("Token Operations", function () {
  let env: any;

  beforeEach(async function () {
    env = await setupTestEnvironment();
  });

  describe("Buying Tokens", function () {
    it("Should allow users to buy tokens in a single bin", async function () {
      const binIndex = 0; // Bet on bin 0
      const amount = ethers.parseEther("100"); // Buy 100 tokens
      const maxCollateral = ethers.parseEther("150"); // Max willing to spend

      // Buy tokens
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(env.marketId, [binIndex], [amount], maxCollateral);

      // Check token balance
      const tokenId = await env.rangeBetToken.encodeTokenId(
        env.marketId,
        binIndex
      );
      expect(
        await env.rangeBetToken.balanceOf(env.user1.address, tokenId)
      ).to.equal(amount);

      // Check market state
      const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      expect(marketInfo[5]).to.equal(amount); // T (total supply)
      expect(marketInfo[6]).to.be.gt(0); // collateralBalance should be positive

      // Check bin quantity
      expect(
        await env.rangeBetManager.getBinQuantity(env.marketId, binIndex)
      ).to.equal(amount);
    });

    it("Should allow users to buy tokens in multiple bins", async function () {
      const binIndices = [-60, 0, 60]; // Bet on bins -60, 0, 60
      const amounts = [
        ethers.parseEther("50"),
        ethers.parseEther("100"),
        ethers.parseEther("150"),
      ];
      const maxCollateral = ethers.parseEther("400"); // Max willing to spend

      // Buy tokens
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(env.marketId, binIndices, amounts, maxCollateral);

      // Check token balances
      for (let i = 0; i < binIndices.length; i++) {
        const tokenId = await env.rangeBetToken.encodeTokenId(
          env.marketId,
          binIndices[i]
        );
        expect(
          await env.rangeBetToken.balanceOf(env.user1.address, tokenId)
        ).to.equal(amounts[i]);
      }

      // Check market state
      const marketInfo = await env.rangeBetManager.getMarketInfo(env.marketId);
      expect(marketInfo[5]).to.equal(
        ethers.parseEther("50") +
          ethers.parseEther("100") +
          ethers.parseEther("150")
      ); // T (total supply)

      // Check bin quantities
      for (let i = 0; i < binIndices.length; i++) {
        expect(
          await env.rangeBetManager.getBinQuantity(env.marketId, binIndices[i])
        ).to.equal(amounts[i]);
      }
    });

    it("Should calculate cost based on (q+t)/(T+t) integral formula", async function () {
      // First user bets on bin 0
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      // Second user also bets on bin 0
      const user1CollateralBefore = await env.collateralToken.balanceOf(
        env.user2.address
      );
      await env.rangeBetManager
        .connect(env.user2)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );
      const user1CollateralAfter = await env.collateralToken.balanceOf(
        env.user2.address
      );
      const secondBetCost = user1CollateralBefore - user1CollateralAfter;

      // Third user bets on bin 60
      const user2CollateralBefore = await env.collateralToken.balanceOf(
        env.user3.address
      );
      await env.rangeBetManager
        .connect(env.user3)
        .buyTokens(
          env.marketId,
          [60],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );
      const user2CollateralAfter = await env.collateralToken.balanceOf(
        env.user3.address
      );
      const thirdBetCost = user2CollateralBefore - user2CollateralAfter;

      // The second bet on the same bin should cost more than the third bet on a different bin
      // due to the formula (q+t)/(T+t)
      expect(secondBetCost).to.be.gt(thirdBetCost);
    });

    it("Should fail when cost exceeds maxCollateral", async function () {
      // Set a very low max collateral
      const lowMaxCollateral = ethers.parseEther("10");

      await expect(
        env.rangeBetManager
          .connect(env.user1)
          .buyTokens(
            env.marketId,
            [0],
            [ethers.parseEther("100")],
            lowMaxCollateral
          )
      ).to.be.revertedWith("Cost exceeds max collateral");
    });

    it("Should fail for invalid bin indices", async function () {
      // Try to buy tokens with invalid bin index (not a multiple of tickSpacing)
      await expect(
        env.rangeBetManager
          .connect(env.user1)
          .buyTokens(
            env.marketId,
            [61],
            [ethers.parseEther("100")],
            ethers.parseEther("150")
          )
      ).to.be.revertedWith("Bin index must be a multiple of tick spacing");

      // Try to buy tokens with bin index out of range
      await expect(
        env.rangeBetManager
          .connect(env.user1)
          .buyTokens(
            env.marketId,
            [420],
            [ethers.parseEther("100")],
            ethers.parseEther("150")
          )
      ).to.be.revertedWith("Bin index out of range");
    });

    // 추가 테스트: 사용자가 실제로 ERC20 잔액이 부족할 때
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

    // 추가 테스트: 사용자가 ERC20 허용량(allowance)이 부족할 때
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

    // 추가 테스트: buyTokens에 amount=0인 케이스를 전달해도 오류 없이 무시되는지
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
