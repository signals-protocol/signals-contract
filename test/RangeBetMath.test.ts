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
});
