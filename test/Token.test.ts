import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SampleToken", function () {
  let sampleToken: any;
  let owner: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;
  const initialSupply = ethers.parseEther("1000000"); // 100만 토큰

  beforeEach(async function () {
    // 테스트마다 새로운 컨트랙트와 지갑 가져오기
    [owner, addr1, addr2] = await ethers.getSigners();

    // 컨트랙트 배포
    const SampleTokenFactory = await ethers.getContractFactory("SampleToken");
    sampleToken = await SampleTokenFactory.deploy(initialSupply);
  });

  describe("배포", function () {
    it("올바른 이름과 심볼 설정", async function () {
      expect(await sampleToken.name()).to.equal("Sample Token");
      expect(await sampleToken.symbol()).to.equal("STKN");
    });

    it("오너에게 초기 공급량 발행", async function () {
      const ownerBalance = await sampleToken.balanceOf(owner.address);
      expect(ownerBalance).to.equal(initialSupply);
    });

    it("총 공급량이 초기 공급량과 같음", async function () {
      expect(await sampleToken.totalSupply()).to.equal(initialSupply);
    });
  });

  describe("토큰 전송", function () {
    it("토큰 전송 가능", async function () {
      const transferAmount = ethers.parseEther("1000");

      // 초기 잔액 확인
      const initialOwnerBalance = await sampleToken.balanceOf(owner.address);

      // owner가 addr1에게 전송
      await sampleToken.transfer(addr1.address, transferAmount);

      // 전송 후 잔액 확인
      const finalOwnerBalance = await sampleToken.balanceOf(owner.address);
      const addr1Balance = await sampleToken.balanceOf(addr1.address);

      expect(finalOwnerBalance).to.equal(initialOwnerBalance - transferAmount);
      expect(addr1Balance).to.equal(transferAmount);
    });

    it("잔액 부족 시 전송 실패", async function () {
      // addr1은 토큰이 없으므로 전송 시도시 실패해야 함
      await expect(
        sampleToken.connect(addr1).transfer(addr2.address, 1)
      ).to.be.revertedWithCustomError(sampleToken, "ERC20InsufficientBalance");
    });
  });

  describe("토큰 민팅", function () {
    it("오너만 새 토큰 발행 가능", async function () {
      const mintAmount = ethers.parseEther("5000");

      // 초기 총 공급량 확인
      const initialTotalSupply = await sampleToken.totalSupply();

      // 민팅 실행
      await sampleToken.mint(addr1.address, mintAmount);

      // 잔액과 총 공급량 확인
      const addr1Balance = await sampleToken.balanceOf(addr1.address);
      const newTotalSupply = await sampleToken.totalSupply();

      expect(addr1Balance).to.equal(mintAmount);
      expect(newTotalSupply).to.equal(initialTotalSupply + mintAmount);
    });

    it("오너가 아니면 민팅 실패", async function () {
      const mintAmount = ethers.parseEther("5000");

      // 오너가 아닌 계정에서 민팅 시도시 실패해야 함
      await expect(
        sampleToken.connect(addr1).mint(addr2.address, mintAmount)
      ).to.be.revertedWithCustomError(
        sampleToken,
        "OwnableUnauthorizedAccount"
      );
    });
  });
});
