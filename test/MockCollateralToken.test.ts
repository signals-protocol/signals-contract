import { expect } from "chai";
import { ethers } from "hardhat";
import { MockCollateralToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("MockCollateralToken", function () {
  let mockToken: MockCollateralToken;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const tokenName = "Mock Collateral";
  const tokenSymbol = "MCOL";
  const initialSupply = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const MockCollateralTokenFactory = await ethers.getContractFactory(
      "MockCollateralToken"
    );
    mockToken = await MockCollateralTokenFactory.deploy(
      tokenName,
      tokenSymbol,
      initialSupply
    );
  });

  describe("Basic Functionality", function () {
    it("Should have correct name and symbol", async function () {
      expect(await mockToken.name()).to.equal(tokenName);
      expect(await mockToken.symbol()).to.equal(tokenSymbol);
    });

    it("Should assign initial supply to owner", async function () {
      const ownerBalance = await mockToken.balanceOf(owner.address);
      expect(ownerBalance).to.equal(initialSupply);
    });

    it("Should allow owner to mint new tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      await mockToken.mint(user1.address, mintAmount);

      const user1Balance = await mockToken.balanceOf(user1.address);
      expect(user1Balance).to.equal(mintAmount);
    });

    it("Should not allow non-owners to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");

      await expect(
        mockToken.connect(user1).mint(user1.address, mintAmount)
      ).to.be.revertedWithCustomError(mockToken, "OwnableUnauthorizedAccount");
    });
  });

  describe("requestTokens Function", function () {
    it("Should allow anyone to request tokens", async function () {
      const requestAmount = ethers.parseEther("5000");

      await mockToken.connect(user1).requestTokens(requestAmount);

      const user1Balance = await mockToken.balanceOf(user1.address);
      expect(user1Balance).to.equal(requestAmount);
    });

    it("Should emit TokensRequested event", async function () {
      const requestAmount = ethers.parseEther("5000");

      await expect(mockToken.connect(user1).requestTokens(requestAmount))
        .to.emit(mockToken, "TokensRequested")
        .withArgs(user1.address, requestAmount);
    });

    it("Should allow multiple users to request tokens", async function () {
      const requestAmount1 = ethers.parseEther("5000");
      const requestAmount2 = ethers.parseEther("10000");

      await mockToken.connect(user1).requestTokens(requestAmount1);
      await mockToken.connect(user2).requestTokens(requestAmount2);

      const user1Balance = await mockToken.balanceOf(user1.address);
      const user2Balance = await mockToken.balanceOf(user2.address);

      expect(user1Balance).to.equal(requestAmount1);
      expect(user2Balance).to.equal(requestAmount2);
    });

    it("Should allow users to request tokens multiple times", async function () {
      const requestAmount1 = ethers.parseEther("5000");
      const requestAmount2 = ethers.parseEther("10000");

      await mockToken.connect(user1).requestTokens(requestAmount1);

      let user1Balance = await mockToken.balanceOf(user1.address);
      expect(user1Balance).to.equal(requestAmount1);

      await mockToken.connect(user1).requestTokens(requestAmount2);

      user1Balance = await mockToken.balanceOf(user1.address);
      expect(user1Balance).to.equal(requestAmount1 + requestAmount2);
    });
  });
});
