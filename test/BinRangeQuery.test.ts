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
      // 마켓에 몇 개의 빈에 토큰을 먼저 구매하여 상태를 만듦
      const bins = [-120, -60, 0, 60, 120];
      const amounts = bins.map(() => ethers.parseEther("100"));

      await env.rangeBetManager.connect(env.user1).buyTokens(
        env.marketId,
        bins,
        amounts,
        ethers.parseEther("500") // 충분한 담보
      );

      // 구간 쿼리 함수 호출
      const [binIndices, quantities] =
        await env.rangeBetManager.getBinQuantitiesInRange(
          env.marketId,
          -180, // minTick보다는 크고
          180 // 일부 토큰이 있는 빈과 없는 빈을 모두 포함하는 범위
        );

      // 7개의 빈이어야 함 (-180, -120, -60, 0, 60, 120, 180)
      expect(binIndices.length).to.equal(7);
      expect(quantities.length).to.equal(7);

      // 실제 인덱스 확인
      expect(binIndices[0]).to.equal(-180);
      expect(binIndices[1]).to.equal(-120);
      expect(binIndices[2]).to.equal(-60);
      expect(binIndices[3]).to.equal(0);
      expect(binIndices[4]).to.equal(60);
      expect(binIndices[5]).to.equal(120);
      expect(binIndices[6]).to.equal(180);

      // 수량 확인
      expect(quantities[0]).to.equal(0); // -180에는 베팅 안 했으므로 0
      expect(quantities[1]).to.equal(ethers.parseEther("100")); // -120
      expect(quantities[2]).to.equal(ethers.parseEther("100")); // -60
      expect(quantities[3]).to.equal(ethers.parseEther("100")); // 0
      expect(quantities[4]).to.equal(ethers.parseEther("100")); // 60
      expect(quantities[5]).to.equal(ethers.parseEther("100")); // 120
      expect(quantities[6]).to.equal(0); // 180에는 베팅 안 했으므로 0
    });

    it("Should return empty arrays for a valid range with no bins", async function () {
      // 틱스페이싱이 60인 마켓에서, 아직 아무도 베팅하지 않은 상태에서 쿼리 실행
      const [binIndices, quantities] =
        await env.rangeBetManager.getBinQuantitiesInRange(
          env.marketId,
          -60,
          60
        );

      // 인덱스는 [-60, 0, 60]이어야 함
      expect(binIndices.length).to.equal(3);
      expect(quantities.length).to.equal(3);

      // 모든 수량은 0이어야 함
      for (let i = 0; i < quantities.length; i++) {
        expect(quantities[i]).to.equal(0);
      }
    });

    it("Should correctly handle a range with a single bin", async function () {
      // 단일 빈에 베팅
      await env.rangeBetManager
        .connect(env.user1)
        .buyTokens(
          env.marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      // 단일 빈 쿼리
      const [binIndices, quantities] =
        await env.rangeBetManager.getBinQuantitiesInRange(env.marketId, 0, 0);

      // 하나의 빈만 있어야 함
      expect(binIndices.length).to.equal(1);
      expect(quantities.length).to.equal(1);
      expect(binIndices[0]).to.equal(0);
      expect(quantities[0]).to.equal(ethers.parseEther("100"));
    });

    it("Should revert for invalid range parameters", async function () {
      // toBinIndex < fromBinIndex인 경우
      await expect(
        env.rangeBetManager.getBinQuantitiesInRange(env.marketId, 60, -60)
      ).to.be.revertedWith("fromBinIndex must be <= toBinIndex");

      // 범위를 벗어난 경우
      await expect(
        env.rangeBetManager.getBinQuantitiesInRange(
          env.marketId,
          -420, // minTick(-360)보다 작음
          0
        )
      ).to.be.revertedWith("Bin index out of range");

      await expect(
        env.rangeBetManager.getBinQuantitiesInRange(
          env.marketId,
          0,
          420 // maxTick(360)보다 큼
        )
      ).to.be.revertedWith("Bin index out of range");

      // tickSpacing의 배수가 아닌 경우
      await expect(
        env.rangeBetManager.getBinQuantitiesInRange(
          env.marketId,
          -61, // 60의 배수가 아님
          0
        )
      ).to.be.revertedWith("fromBinIndex not multiple of tickSpacing");

      await expect(
        env.rangeBetManager.getBinQuantitiesInRange(
          env.marketId,
          0,
          61 // 60의 배수가 아님
        )
      ).to.be.revertedWith("toBinIndex not multiple of tickSpacing");
    });
  });
});
