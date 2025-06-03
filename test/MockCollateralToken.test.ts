import { expect } from "chai";
import { ethers } from "hardhat";
import { MockCollateralToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("MockCollateralToken", function () {
  let mockToken: MockCollateralToken;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  const tokenName = "Mock Collateral";
  const tokenSymbol = "MCOL";
  const initialSupply = ethers.parseEther("1000000");
  const DEFAULT_FREE_MINT_AMOUNT = ethers.parseEther("500");

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    const MockCollateralTokenFactory = await ethers.getContractFactory(
      "MockCollateralToken"
    );
    mockToken = await MockCollateralTokenFactory.deploy(
      tokenName,
      tokenSymbol,
      initialSupply
    );
  });

  describe("Deployment & Basic Properties", function () {
    it("Should have correct name, symbol, and decimals", async function () {
      expect(await mockToken.name()).to.equal(tokenName);
      expect(await mockToken.symbol()).to.equal(tokenSymbol);
      expect(await mockToken.decimals()).to.equal(18);
    });

    it("Should assign initial supply to deployer", async function () {
      const ownerBalance = await mockToken.balanceOf(owner.address);
      expect(ownerBalance).to.equal(initialSupply);
    });

    it("Should set deployer as owner", async function () {
      expect(await mockToken.owner()).to.equal(owner.address);
    });

    it("Should have free mint enabled by default", async function () {
      expect(await mockToken.freeMintEnabled()).to.be.true;
    });

    it("Should have correct default free mint amount", async function () {
      expect(await mockToken.freeMintAmount()).to.equal(
        DEFAULT_FREE_MINT_AMOUNT
      );
    });
  });

  describe("Basic mint() Function", function () {
    it("Should allow owner to mint tokens", async function () {
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

    it("Should revert when minting to zero address", async function () {
      const mintAmount = ethers.parseEther("1000");

      await expect(
        mockToken.mint(ethers.ZeroAddress, mintAmount)
      ).to.be.revertedWith("Cannot mint to zero address");
    });

    it("Should revert when minting zero amount", async function () {
      await expect(mockToken.mint(user1.address, 0)).to.be.revertedWith(
        "Amount must be greater than 0"
      );
    });
  });

  describe("mintTo() Function - Special Owner Mint", function () {
    it("Should allow owner to mint with tracking", async function () {
      const mintAmount = ethers.parseEther("1000");

      await expect(mockToken.mintTo(user1.address, mintAmount))
        .to.emit(mockToken, "MintedTo")
        .withArgs(user1.address, mintAmount, 1);

      const user1Balance = await mockToken.balanceOf(user1.address);
      expect(user1Balance).to.equal(mintAmount);

      const [hasFreeMinted, ownerMintCount, totalOwnerMinted] =
        await mockToken.getMintInfo(user1.address);
      expect(hasFreeMinted).to.be.false;
      expect(ownerMintCount).to.equal(1);
      expect(totalOwnerMinted).to.equal(mintAmount);
    });

    it("Should track multiple mints correctly", async function () {
      const mintAmount1 = ethers.parseEther("1000");
      const mintAmount2 = ethers.parseEther("2000");

      await mockToken.mintTo(user1.address, mintAmount1);
      await mockToken.mintTo(user1.address, mintAmount2);

      const [, ownerMintCount, totalOwnerMinted] = await mockToken.getMintInfo(
        user1.address
      );
      expect(ownerMintCount).to.equal(2);
      expect(totalOwnerMinted).to.equal(mintAmount1 + mintAmount2);
    });

    it("Should not allow non-owners to use mintTo", async function () {
      const mintAmount = ethers.parseEther("1000");

      await expect(
        mockToken.connect(user1).mintTo(user1.address, mintAmount)
      ).to.be.revertedWithCustomError(mockToken, "OwnableUnauthorizedAccount");
    });

    it("Should revert when minting to zero address", async function () {
      const mintAmount = ethers.parseEther("1000");

      await expect(
        mockToken.mintTo(ethers.ZeroAddress, mintAmount)
      ).to.be.revertedWith("Cannot mint to zero address");
    });

    it("Should revert when minting zero amount", async function () {
      await expect(mockToken.mintTo(user1.address, 0)).to.be.revertedWith(
        "Amount must be greater than 0"
      );
    });
  });

  describe("claimFreeMint() Function", function () {
    it("Should allow user to claim free mint once", async function () {
      const freeMintAmount = await mockToken.freeMintAmount();

      await expect(mockToken.connect(user1).claimFreeMint())
        .to.emit(mockToken, "FreeMintClaimed")
        .withArgs(user1.address, freeMintAmount);

      const user1Balance = await mockToken.balanceOf(user1.address);
      expect(user1Balance).to.equal(freeMintAmount);

      const [hasFreeMinted] = await mockToken.getMintInfo(user1.address);
      expect(hasFreeMinted).to.be.true;
    });

    it("Should not allow user to claim free mint twice", async function () {
      await mockToken.connect(user1).claimFreeMint();

      await expect(mockToken.connect(user1).claimFreeMint()).to.be.revertedWith(
        "Already claimed free tokens"
      );
    });

    it("Should allow multiple users to claim free mint", async function () {
      const freeMintAmount = await mockToken.freeMintAmount();

      await mockToken.connect(user1).claimFreeMint();
      await mockToken.connect(user2).claimFreeMint();
      await mockToken.connect(user3).claimFreeMint();

      expect(await mockToken.balanceOf(user1.address)).to.equal(freeMintAmount);
      expect(await mockToken.balanceOf(user2.address)).to.equal(freeMintAmount);
      expect(await mockToken.balanceOf(user3.address)).to.equal(freeMintAmount);
    });

    it("Should not allow claim when free mint is disabled", async function () {
      await mockToken.setFreeMintEnabled(false);

      await expect(mockToken.connect(user1).claimFreeMint()).to.be.revertedWith(
        "Free mint is currently disabled"
      );
    });

    it("Should work after re-enabling free mint", async function () {
      await mockToken.setFreeMintEnabled(false);
      await mockToken.setFreeMintEnabled(true);

      await expect(mockToken.connect(user1).claimFreeMint()).to.emit(
        mockToken,
        "FreeMintClaimed"
      );
    });
  });

  describe("setFreeMintEnabled() Function", function () {
    it("Should allow owner to disable free mint", async function () {
      await expect(mockToken.setFreeMintEnabled(false))
        .to.emit(mockToken, "FreeMintEnabledSet")
        .withArgs(false);

      expect(await mockToken.freeMintEnabled()).to.be.false;
    });

    it("Should allow owner to enable free mint", async function () {
      await mockToken.setFreeMintEnabled(false);

      await expect(mockToken.setFreeMintEnabled(true))
        .to.emit(mockToken, "FreeMintEnabledSet")
        .withArgs(true);

      expect(await mockToken.freeMintEnabled()).to.be.true;
    });

    it("Should not allow non-owners to change free mint status", async function () {
      await expect(
        mockToken.connect(user1).setFreeMintEnabled(false)
      ).to.be.revertedWithCustomError(mockToken, "OwnableUnauthorizedAccount");
    });
  });

  describe("setFreeMintAmount() Function", function () {
    it("Should allow owner to set free mint amount", async function () {
      const newAmount = ethers.parseEther("1000");
      const oldAmount = await mockToken.freeMintAmount();

      await expect(mockToken.setFreeMintAmount(newAmount))
        .to.emit(mockToken, "FreeMintAmountSet")
        .withArgs(oldAmount, newAmount);

      expect(await mockToken.freeMintAmount()).to.equal(newAmount);
    });

    it("Should not allow non-owners to set free mint amount", async function () {
      const newAmount = ethers.parseEther("1000");

      await expect(
        mockToken.connect(user1).setFreeMintAmount(newAmount)
      ).to.be.revertedWithCustomError(mockToken, "OwnableUnauthorizedAccount");
    });

    it("Should revert when setting zero amount", async function () {
      await expect(mockToken.setFreeMintAmount(0)).to.be.revertedWith(
        "Free mint amount must be greater than 0"
      );
    });

    it("Should affect new claims after amount change", async function () {
      // Change amount to 1000 tokens
      const newAmount = ethers.parseEther("1000");
      await mockToken.setFreeMintAmount(newAmount);

      // User claims with new amount
      await expect(mockToken.connect(user1).claimFreeMint())
        .to.emit(mockToken, "FreeMintClaimed")
        .withArgs(user1.address, newAmount);

      expect(await mockToken.balanceOf(user1.address)).to.equal(newAmount);
    });

    it("Should not affect users who already claimed", async function () {
      // User1 claims with default amount
      const defaultAmount = await mockToken.freeMintAmount();
      await mockToken.connect(user1).claimFreeMint();

      const balanceAfterFirstClaim = await mockToken.balanceOf(user1.address);
      expect(balanceAfterFirstClaim).to.equal(defaultAmount);

      // Change amount
      const newAmount = ethers.parseEther("2000");
      await mockToken.setFreeMintAmount(newAmount);

      // User1 cannot claim again (already claimed)
      await expect(mockToken.connect(user1).claimFreeMint()).to.be.revertedWith(
        "Already claimed free tokens"
      );

      // User1's balance should remain the same
      expect(await mockToken.balanceOf(user1.address)).to.equal(
        balanceAfterFirstClaim
      );

      // User2 claims with new amount
      await mockToken.connect(user2).claimFreeMint();
      expect(await mockToken.balanceOf(user2.address)).to.equal(newAmount);
    });

    it("Should handle multiple amount changes correctly", async function () {
      const amounts = [
        ethers.parseEther("100"),
        ethers.parseEther("750"),
        ethers.parseEther("2000"),
      ];

      for (let i = 0; i < amounts.length; i++) {
        const oldAmount = await mockToken.freeMintAmount();

        await expect(mockToken.setFreeMintAmount(amounts[i]))
          .to.emit(mockToken, "FreeMintAmountSet")
          .withArgs(oldAmount, amounts[i]);

        expect(await mockToken.freeMintAmount()).to.equal(amounts[i]);
      }
    });
  });

  describe("View Functions", function () {
    it("Should return correct mint info for new user", async function () {
      const [hasFreeMinted, ownerMintCount, totalOwnerMinted] =
        await mockToken.getMintInfo(user1.address);

      expect(hasFreeMinted).to.be.false;
      expect(ownerMintCount).to.equal(0);
      expect(totalOwnerMinted).to.equal(0);
    });

    it("Should return correct mint info after free mint", async function () {
      await mockToken.connect(user1).claimFreeMint();

      const [hasFreeMinted, ownerMintCount, totalOwnerMinted] =
        await mockToken.getMintInfo(user1.address);

      expect(hasFreeMinted).to.be.true;
      expect(ownerMintCount).to.equal(0);
      expect(totalOwnerMinted).to.equal(0);
    });

    it("Should return correct mint info after owner mint", async function () {
      const mintAmount = ethers.parseEther("1000");
      await mockToken.mintTo(user1.address, mintAmount);

      const [hasFreeMinted, ownerMintCount, totalOwnerMinted] =
        await mockToken.getMintInfo(user1.address);

      expect(hasFreeMinted).to.be.false;
      expect(ownerMintCount).to.equal(1);
      expect(totalOwnerMinted).to.equal(mintAmount);
    });

    it("Should return correct canClaimFreeMint status", async function () {
      // Initially should be able to claim
      expect(await mockToken.canClaimFreeMint(user1.address)).to.be.true;

      // After claiming, should not be able to claim
      await mockToken.connect(user1).claimFreeMint();
      expect(await mockToken.canClaimFreeMint(user1.address)).to.be.false;

      // When disabled, should not be able to claim
      expect(await mockToken.canClaimFreeMint(user2.address)).to.be.true;
      await mockToken.setFreeMintEnabled(false);
      expect(await mockToken.canClaimFreeMint(user2.address)).to.be.false;
    });
  });

  describe("Complex Scenarios", function () {
    it("Should handle mixed mint operations correctly", async function () {
      // User1: Free mint + owner mint
      await mockToken.connect(user1).claimFreeMint();
      await mockToken.mintTo(user1.address, ethers.parseEther("1000"));

      // User2: Only owner mint (multiple times)
      await mockToken.mintTo(user2.address, ethers.parseEther("500"));
      await mockToken.mintTo(user2.address, ethers.parseEther("1500"));

      // User3: Only free mint
      await mockToken.connect(user3).claimFreeMint();

      // Check balances
      expect(await mockToken.balanceOf(user1.address)).to.equal(
        ethers.parseEther("1500")
      );
      expect(await mockToken.balanceOf(user2.address)).to.equal(
        ethers.parseEther("2000")
      );
      const freeMintAmount = await mockToken.freeMintAmount();
      expect(await mockToken.balanceOf(user3.address)).to.equal(freeMintAmount);

      // Check mint info
      const [hasFreeMinted1, ownerMintCount1, totalOwnerMinted1] =
        await mockToken.getMintInfo(user1.address);
      expect(hasFreeMinted1).to.be.true;
      expect(ownerMintCount1).to.equal(1);
      expect(totalOwnerMinted1).to.equal(ethers.parseEther("1000"));

      const [hasFreeMinted2, ownerMintCount2, totalOwnerMinted2] =
        await mockToken.getMintInfo(user2.address);
      expect(hasFreeMinted2).to.be.false;
      expect(ownerMintCount2).to.equal(2);
      expect(totalOwnerMinted2).to.equal(ethers.parseEther("2000"));

      const [hasFreeMinted3, ownerMintCount3, totalOwnerMinted3] =
        await mockToken.getMintInfo(user3.address);
      expect(hasFreeMinted3).to.be.true;
      expect(ownerMintCount3).to.equal(0);
      expect(totalOwnerMinted3).to.equal(0);
    });

    it("Should handle free mint disable/enable scenarios", async function () {
      // User1 claims before disable
      await mockToken.connect(user1).claimFreeMint();

      // Disable free mint
      await mockToken.setFreeMintEnabled(false);

      // User2 cannot claim
      await expect(mockToken.connect(user2).claimFreeMint()).to.be.revertedWith(
        "Free mint is currently disabled"
      );

      // Re-enable free mint
      await mockToken.setFreeMintEnabled(true);

      // User2 can now claim
      await mockToken.connect(user2).claimFreeMint();

      // User1 still cannot claim again
      await expect(mockToken.connect(user1).claimFreeMint()).to.be.revertedWith(
        "Already claimed free tokens"
      );
    });

    it("Should handle large numbers correctly", async function () {
      const largeAmount = ethers.parseEther("1000000000"); // 1 billion tokens

      await mockToken.mintTo(user1.address, largeAmount);

      const [, ownerMintCount, totalOwnerMinted] = await mockToken.getMintInfo(
        user1.address
      );
      expect(ownerMintCount).to.equal(1);
      expect(totalOwnerMinted).to.equal(largeAmount);
      expect(await mockToken.balanceOf(user1.address)).to.equal(largeAmount);
    });
  });

  describe("Edge Cases & Error Conditions", function () {
    it("Should handle zero address queries gracefully", async function () {
      const [hasFreeMinted, ownerMintCount, totalOwnerMinted] =
        await mockToken.getMintInfo(ethers.ZeroAddress);

      expect(hasFreeMinted).to.be.false;
      expect(ownerMintCount).to.equal(0);
      expect(totalOwnerMinted).to.equal(0);
    });

    it("Should handle canClaimFreeMint for zero address", async function () {
      expect(await mockToken.canClaimFreeMint(ethers.ZeroAddress)).to.be.true;
    });

    it("Should maintain state consistency after ownership transfer", async function () {
      // Transfer ownership
      await mockToken.transferOwnership(user1.address);

      // Old owner cannot mint
      await expect(
        mockToken.mint(user2.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(mockToken, "OwnableUnauthorizedAccount");

      // New owner can mint
      await mockToken
        .connect(user1)
        .mint(user2.address, ethers.parseEther("1000"));
      expect(await mockToken.balanceOf(user2.address)).to.equal(
        ethers.parseEther("1000")
      );
    });
  });
});
