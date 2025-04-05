import { expect } from "chai";
import { ethers } from "hardhat";
import { RangeBetMath } from "../typechain-types";

describe("RangeBetMath", function () {
  let rangeBetMath: RangeBetMath;

  before(async function () {
    const RangeBetMathFactory = await ethers.getContractFactory("RangeBetMath");
    rangeBetMath = await RangeBetMathFactory.deploy();
    await rangeBetMath.waitForDeployment();
  });

  describe("calculateCost", function () {
    it("Should return 0 for 0 tokens", async function () {
      const cost = await rangeBetMath.calculateCost(0, 100, 1000);
      expect(cost).to.equal(0);
    });

    it("Should return x for empty market (T=0)", async function () {
      const x = ethers.parseEther("100");
      const cost = await rangeBetMath.calculateCost(x, 0, 0);
      expect(cost).to.equal(x);
    });

    it("Should return x for q=T case", async function () {
      const x = ethers.parseEther("50");
      const T = ethers.parseEther("100");
      const cost = await rangeBetMath.calculateCost(x, T, T);
      expect(cost).to.equal(x);
    });

    it("Should return less than x for q<T case", async function () {
      const x = ethers.parseEther("50");
      const q = ethers.parseEther("50");
      const T = ethers.parseEther("100");
      const cost = await rangeBetMath.calculateCost(x, q, T);
      expect(cost).to.be.lt(x);
    });

    it("Should return more than x for q>T case (impossible in real scenario but math works)", async function () {
      const x = ethers.parseEther("50");
      const q = ethers.parseEther("150");
      const T = ethers.parseEther("100");
      const cost = await rangeBetMath.calculateCost(x, q, T);
      expect(cost).to.be.gt(x);
    });
  });

  describe("calculateX", function () {
    it("Should return 0 for 0 cost", async function () {
      const x = await rangeBetMath.calculateX(0, 100, 1000);
      expect(x).to.equal(0);
    });

    it("Should return cost for empty market (T=0)", async function () {
      const cost = ethers.parseEther("100");
      const x = await rangeBetMath.calculateX(cost, 0, 0);
      expect(x).to.equal(cost);
    });

    it("Should return cost for q=T case", async function () {
      const cost = ethers.parseEther("50");
      const T = ethers.parseEther("100");
      const x = await rangeBetMath.calculateX(cost, T, T);
      expect(x).to.be.closeTo(cost, ethers.parseEther("0.001"));
    });

    it("Should handle extreme case with q close to 0", async function () {
      // When q is very small, the integral becomes very steep
      const T = ethers.parseEther("1000");
      const q = ethers.parseEther("0.001"); // Very small q
      const cost = ethers.parseEther("10");

      // Calculate x for this cost
      const x = await rangeBetMath.calculateX(cost, q, T);

      // Verify the cost calculation matches for this x
      const calculatedCost = await rangeBetMath.calculateCost(x, q, T);

      // Allow for small rounding differences
      expect(calculatedCost).to.be.closeTo(cost, ethers.parseEther("0.001"));

      // Check that x is greater than cost (since q < T)
      expect(x).to.be.gt(cost);

      // Ensure x is less than our upper bound
      if (q > 0n) {
        const upperBound = (T * cost) / q;
        expect(x).to.be.lt(upperBound);
      }
    });

    it("Should handle q=0 case correctly", async function () {
      // For non-empty market (T>0) with q=0
      const T = ethers.parseEther("1000");
      const q = 0n; // q is exactly 0
      const cost = ethers.parseEther("50");

      // Calculate x for this cost
      const x = await rangeBetMath.calculateX(cost, q, T);

      // Calculate cost with the resulting x
      const calculatedCost = await rangeBetMath.calculateCost(x, q, T);

      // Verify it matches the original cost
      expect(calculatedCost).to.be.closeTo(cost, ethers.parseEther("0.001"));

      // In this case, the mathematical formula simplifies to:
      // cost = x - T*ln((T+x)/T)
      // The binary search should still find the right value
      console.log(
        `q=0, T=${ethers.formatEther(T)}, cost=${ethers.formatEther(
          cost
        )}: x=${ethers.formatEther(x)}`
      );
    });

    it("Should handle extreme case with q very close to T", async function () {
      const T = ethers.parseEther("1000");
      const q = T - ethers.parseEther("0.001"); // q very close to T
      const cost = ethers.parseEther("50");

      const x = await rangeBetMath.calculateX(cost, q, T);
      const calculatedCost = await rangeBetMath.calculateCost(x, q, T);

      expect(calculatedCost).to.be.closeTo(cost, ethers.parseEther("0.001"));
      expect(x).to.be.closeTo(cost, ethers.parseEther("0.1"));
    });

    it("Should verify binary search upper bound is always sufficient", async function () {
      // Test various q/T ratios
      const testCases = [
        { q: "0", T: "1000", cost: "10" }, // q = 0 (critical case)
        { q: "0.001", T: "1000", cost: "10" }, // q ≈ 0
        { q: "1", T: "1000", cost: "10" }, // q << T
        { q: "400", T: "1000", cost: "50" }, // q < T
        { q: "999", T: "1000", cost: "100" }, // q ≈ T
        { q: "1000", T: "1000", cost: "200" }, // q = T
      ];

      for (const tc of testCases) {
        const q = ethers.parseEther(tc.q);
        const T = ethers.parseEther(tc.T);
        const cost = ethers.parseEther(tc.cost);

        // What we're testing: if (q > 0) { right = (T * cost) / q; }
        const upperBound = q > 0n ? (T * cost) / q : ethers.MaxUint256;

        // Calculate x
        const x = await rangeBetMath.calculateX(cost, q, T);

        // Verify cost calculation
        const calculatedCost = await rangeBetMath.calculateCost(x, q, T);
        expect(calculatedCost).to.be.closeTo(cost, ethers.parseEther("0.001"));

        // Verify x is within bounds
        expect(x).to.be.lte(upperBound);

        console.log(
          `q=${tc.q}, T=${tc.T}, cost=${tc.cost}: x=${ethers.formatEther(
            x
          )}, upperBound=${
            q > 0n ? ethers.formatEther(upperBound) : "MaxUint256"
          }`
        );
      }
    });

    it("Should round-trip cost->x->cost correctly for various scenarios", async function () {
      // Test with a wide range of input values
      const testCases = [
        { x: "10", q: "5", T: "100" }, // Standard case
        { x: "1000", q: "0.1", T: "1000" }, // Small q
        { x: "50", q: "999", T: "1000" }, // q close to T
        { x: "100", q: "1000", T: "1000" }, // q = T
        { x: "100", q: "0", T: "1000" }, // q = 0
      ];

      for (const tc of testCases) {
        const x = ethers.parseEther(tc.x);
        const q = ethers.parseEther(tc.q);
        const T = ethers.parseEther(tc.T);

        // Calculate cost for x
        const cost = await rangeBetMath.calculateCost(x, q, T);

        // Now calculate x for this cost
        const calculatedX = await rangeBetMath.calculateX(cost, q, T);

        // Should get back approximately the same x
        expect(calculatedX).to.be.closeTo(x, ethers.parseEther("0.1"));

        console.log(
          `x=${tc.x}, q=${tc.q}, T=${tc.T}: cost=${ethers.formatEther(
            cost
          )}, calculatedX=${ethers.formatEther(calculatedX)}`
        );
      }
    });
  });

  describe("calculateSellCost", function () {
    it("Should return 0 for 0 tokens", async function () {
      const revenue = await rangeBetMath.calculateSellCost(0, 100, 1000);
      expect(revenue).to.equal(0);
    });

    it("Should revert when trying to sell more than q", async function () {
      const x = ethers.parseEther("110");
      const q = ethers.parseEther("100");
      const T = ethers.parseEther("1000");

      await expect(rangeBetMath.calculateSellCost(x, q, T)).to.be.revertedWith(
        "Cannot sell more tokens than available in bin"
      );
    });

    it("Should revert when trying to sell more than T", async function () {
      const x = ethers.parseEther("1100");
      const q = ethers.parseEther("1100");
      const T = ethers.parseEther("1000");

      await expect(rangeBetMath.calculateSellCost(x, q, T)).to.be.revertedWith(
        "Cannot sell more tokens than total supply"
      );
    });

    it("Should revert when trying to sell exactly T (edge case)", async function () {
      const T = ethers.parseEther("1000");
      const q = T;

      await expect(rangeBetMath.calculateSellCost(T, q, T)).to.be.revertedWith(
        "Cannot sell entire market supply (T=x)"
      );
    });

    it("Should return exactly x for q=T case", async function () {
      const x = ethers.parseEther("50");
      const T = ethers.parseEther("100");
      const revenue = await rangeBetMath.calculateSellCost(x, T, T);
      expect(revenue).to.equal(x);
    });

    it("Should return less than x for q<T case", async function () {
      const x = ethers.parseEther("50");
      const q = ethers.parseEther("50");
      const T = ethers.parseEther("100");
      const revenue = await rangeBetMath.calculateSellCost(x, q, T);
      expect(revenue).to.be.lt(x);
    });

    it("Should return more than x for q>T case", async function () {
      const x = ethers.parseEther("50");
      const q = ethers.parseEther("150");
      const T = ethers.parseEther("100");
      const revenue = await rangeBetMath.calculateSellCost(x, q, T);
      expect(revenue).to.be.gt(x);
    });

    it("Should verify buy/sell symmetry for partial amounts", async function () {
      // 초기 상태: bin q=0, 전체 T=0
      // A 사용자가 x=10 매수 (비용 = 10, 첫 매수)
      // 매수 후 상태: q=10, T=10
      // 이제 x=5 매도 -> 수익 계산: sellRevenue(5; 10, 10) = 5

      const initialBuy = ethers.parseEther("10");
      const partialSell = ethers.parseEther("5");

      // 매수 후 상태: q=10, T=10
      const q = initialBuy;
      const T = initialBuy;

      // 매도 수익 계산
      const sellRevenue = await rangeBetMath.calculateSellCost(
        partialSell,
        q, // q = 10
        T // T = 10
      );

      // 매도 수익이 정확히 5가 되어야 함 (q=T 이므로)
      expect(sellRevenue).to.equal(partialSell);

      // 잔여 토큰 5개에 대한 추가 매도 테스트
      const remainingTokens = initialBuy - partialSell;

      // 첫 매도 후 상태: q=5, T=5가 아니라, bin 상태는 그대로 유지
      // 단지 계산만 하는 함수이므로 실제 상태를 변경하지는 않음
      // 두 번째 매도에 대해 q와 T 값은 여전히 초기값 유지
      const additionalSellRevenue = await rangeBetMath.calculateSellCost(
        remainingTokens,
        q, // q는 여전히 10
        T // T는 여전히 10
      );

      // 두 번째 매도 수익도 정확히 5가 되어야 함 (q=T 이므로)
      expect(additionalSellRevenue).to.equal(remainingTokens);

      // 총 매도 수익 = 첫 매도(5) + 두번째 매도(5) = 10
      const totalSellRevenue = sellRevenue + additionalSellRevenue;
      expect(totalSellRevenue).to.equal(initialBuy);
    });

    it("Should handle complex buy then sell scenario", async function () {
      // 초기 상태: q=0, T=0
      // 1) 10 토큰 매수 -> 비용 10
      // 2) q=10, T=10 상태에서 추가로 2 더 매수 -> 로그항 있는 비용 계산
      // 3) q=12, T=12 상태에서 6 매도 -> 수익 계산

      // 1단계: 첫 매수 (비용 = 10)
      const firstBuy = ethers.parseEther("10");

      // 첫 매수 후 상태: q=10, T=10
      const q1 = firstBuy;
      const T1 = firstBuy;

      // 2단계: 추가 매수
      const secondBuy = ethers.parseEther("2");
      const secondBuyCost = await rangeBetMath.calculateCost(
        secondBuy,
        q1, // q = 10
        T1 // T = 10
      );

      // 추가 매수 후 상태: q=12, T=12
      const q2 = q1 + secondBuy;
      const T2 = T1 + secondBuy;

      // 3단계: 부분 매도
      const partialSell = ethers.parseEther("6");
      const sellRevenue = await rangeBetMath.calculateSellCost(
        partialSell,
        q2, // q = 12
        T2 // T = 12
      );

      // 검증: 매도 수익은 정확히 6이어야 함 (q=T 이므로)
      expect(sellRevenue).to.equal(partialSell);

      // 잔여 토큰에 대한 매도 테스트
      // 참고: 실제 상태 변경은 없으므로, 그대로 q2와 T2 사용
      const remainingSellAmount = q2 - partialSell; // 6
      const remainingSellRevenue = await rangeBetMath.calculateSellCost(
        remainingSellAmount, // 남은 토큰 수 = 6
        q2, // q = 12 (상태는 변경되지 않음)
        T2 // T = 12 (상태는 변경되지 않음)
      );

      // 검증: 잔여 매도 수익은 잔여량과 같아야 함 (q=T 이므로)
      expect(remainingSellRevenue).to.equal(remainingSellAmount);

      // 총 매도 수익
      const totalSellRevenue = sellRevenue + remainingSellRevenue;
      // 총 매수 비용
      const totalBuyCost = firstBuy + secondBuyCost;

      // 검증: 총 매도 수익과 총 매수 비용이 유사해야 함
      expect(totalSellRevenue).to.be.closeTo(
        totalBuyCost,
        ethers.parseEther("0.001")
      );

      console.log(
        `Total buy cost: ${ethers.formatEther(totalBuyCost)}, ` +
          `Total sell revenue: ${ethers.formatEther(totalSellRevenue)}`
      );
    });
  });
});
