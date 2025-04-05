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
      // 1) 먼저 마켓에 토큰을 매수
      await env.rangeBetManager.connect(env.user1).buyTokens(
        env.marketId,
        [0], // bin index 0
        [ethers.parseEther("100")], // 100 tokens
        ethers.parseEther("150") // max collateral
      );

      // 2) 이제 sell 비용 계산
      const sellAmount = ethers.parseEther("50"); // 50 tokens
      const sellRevenue = await env.rangeBetManager.calculateBinSellCost(
        env.marketId,
        0, // 같은 bin
        sellAmount
      );

      // 3) 검증: q=T 상태에서는 sellRevenue는 sellAmount와 동일해야 함
      expect(sellRevenue).to.equal(sellAmount);
    });

    it("Should handle multiple bins correctly", async function () {
      // 1) 각 bin별로 따로 매수 (각 bin의 q와 전체 T가 모두 증가하도록)
      // 먼저 첫 번째 bin에 토큰 매수
      await env.rangeBetManager.connect(env.user1).buyTokens(
        env.marketId,
        [0], // bin index 0
        [ethers.parseEther("50")], // 50 tokens
        ethers.parseEther("100") // max collateral
      );

      // 두 번째 bin에 추가 매수
      await env.rangeBetManager.connect(env.user1).buyTokens(
        env.marketId,
        [60], // bin index 60
        [ethers.parseEther("50")], // 50 tokens
        ethers.parseEther("100") // max collateral
      );

      // 2) 첫 번째 bin에서 일부 매도 비용 계산
      const sellAmount1 = ethers.parseEther("25"); // 25 tokens
      const sellRevenue1 = await env.rangeBetManager.calculateBinSellCost(
        env.marketId,
        0,
        sellAmount1
      );

      // 3) 두 번째 bin에서 일부 매도 비용 계산
      const sellAmount2 = ethers.parseEther("25"); // 25 tokens
      const sellRevenue2 = await env.rangeBetManager.calculateBinSellCost(
        env.marketId,
        60,
        sellAmount2
      );

      // 4) 이 경우 각 bin의 q값은 각각 50, 전체 T는 100임
      // q1=50, q2=50, T=100인 상태에서는 q!=T 이므로 로그항 계산이 들어감
      // 따라서 sell amount와 정확히 같지는 않을 수 있음
      // 이 테스트에서는 단지 계산이 성공적으로 이루어지는지만 확인
      expect(sellRevenue1).to.be.gt(0);
      expect(sellRevenue2).to.be.gt(0);
    });

    it("Should revert for inactive market", async function () {
      // 1) 먼저 마켓에 토큰을 매수
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      // 2) 마켓 비활성화
      await env.rangeBetManager.deactivateMarket(env.marketId);

      // 3) 매도 비용 계산 시도 - 이제 revert 예상
      await expect(
        env.rangeBetManager.calculateBinSellCost(
          env.marketId,
          0,
          ethers.parseEther("50")
        )
      ).to.be.revertedWith("Market is not active or closed");
    });

    it("Should revert for out of range bin index", async function () {
      // 범위를 벗어난 bin index에 대한 매도 비용 계산
      await expect(
        env.rangeBetManager.calculateBinSellCost(
          env.marketId,
          600, // 범위 밖
          ethers.parseEther("50")
        )
      ).to.be.revertedWith("Bin index out of range");
    });

    it("Should revert for invalid bin index", async function () {
      // tickSpacing의 배수가 아닌 bin index에 대한 매도 비용 계산
      await expect(
        env.rangeBetManager.calculateBinSellCost(
          env.marketId,
          61, // 60의 배수가 아님
          ethers.parseEther("50")
        )
      ).to.be.revertedWith("Bin index must be a multiple of tick spacing");
    });

    it("Should revert when trying to sell more than available", async function () {
      // 1) 마켓에 일부 토큰 매수
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("50")],
          ethers.parseEther("100")
        );

      // 2) 보유량보다 많은 토큰 매도 시도
      await expect(
        env.rangeBetManager.calculateBinSellCost(
          env.marketId,
          0,
          ethers.parseEther("100") // 보유한 50보다 많음
        )
      ).to.be.revertedWith("Cannot sell more tokens than available in bin");
    });

    it("Should verify buy/sell symmetry with actual contract state", async function () {
      // 1) 최초 매수
      const buyAmount = ethers.parseEther("100");
      const buyTx = await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(env.marketId, [0], [buyAmount], ethers.parseEther("150"));

      // 2) 매수 cost 확인 (처음 매수니까 buyAmount와 동일)
      const receipt = await buyTx.wait();
      const tokensBoughtEvent = receipt?.logs.find(
        (log: any) => log.fragment?.name === "TokensBought"
      );
      const buyCost = (tokensBoughtEvent as any).args[4]; // totalCost

      // 3) 부분 매도 비용 계산 (50%)
      const sellAmount = buyAmount / 2n;
      const sellRevenue1 = await env.rangeBetManager.calculateBinSellCost(
        env.marketId,
        0,
        sellAmount
      );

      // 4) 나머지 매도 비용 계산 (나머지 50%)
      const sellRevenue2 = await env.rangeBetManager.calculateBinSellCost(
        env.marketId,
        0,
        sellAmount
      );

      // 5) 총 매도 수익은 매수 비용과 동일해야 함 (q=T 케이스)
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
      // 1) 먼저 충분한 유동성을 생성 (다른 유저가 이미 포지션을 가짐)
      await env.rangeBetManager.connect(env.user1).buyTokens(
        env.marketId,
        [0], // bin index 0
        [ethers.parseEther("1000")], // 1000 tokens의 큰 유동성
        ethers.parseEther("1100") // max collateral
      );

      // 2) 이제 테스트 대상 유저(user2)가 매수
      const buyAmount = ethers.parseEther("50"); // 50 tokens 매수
      const buyTx = await env.rangeBetManager.connect(env.user2).buyTokens(
        env.marketId,
        [0], // 같은 bin
        [buyAmount],
        ethers.parseEther("100") // 충분한 max collateral
      );

      // 3) 매수 비용 확인
      const receipt = await buyTx.wait();
      const tokensBoughtEvent = receipt?.logs.find(
        (log: any) => log.fragment?.name === "TokensBought"
      );
      const buyCost = (tokensBoughtEvent as any).args[4]; // totalCost

      // 4) 동일한 양에 대한 매도 비용 계산
      const sellRevenue = await env.rangeBetManager.calculateBinSellCost(
        env.marketId,
        0,
        buyAmount // 매수한 것과 동일한 양
      );

      // 5) 매수 비용과 매도 수익은 근접해야 함 (AMM 원리상 완전히 동일하지는 않음)
      // 특히 유동성이 이미 존재하는 상황에서는 더 근접할 것임
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
