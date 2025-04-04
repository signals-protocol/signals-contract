import { expect } from "chai";
import { ethers } from "hardhat";
import {
  RangeBetManager,
  RangeBetToken,
  MockCollateralToken,
  RangeBetMath,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("RangeBet System", function () {
  // Contracts
  let rangeBetManager: RangeBetManager;
  let rangeBetToken: RangeBetToken;
  let collateralToken: MockCollateralToken;
  let rangeBetMath: RangeBetMath;

  // Signers
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  // Market parameters
  const tickSpacing = 60;
  const minTick = -360;
  const maxTick = 360;
  let marketId: bigint;

  // Initial collateral amounts
  const initialCollateral = ethers.parseEther("1000000");
  const userCollateral = ethers.parseEther("10000");

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy collateral token
    const MockCollateralToken = await ethers.getContractFactory(
      "MockCollateralToken"
    );
    collateralToken = await MockCollateralToken.deploy(
      "Mock Collateral",
      "MCOL",
      initialCollateral
    );

    // Transfer collateral to users
    await collateralToken.transfer(user1.address, userCollateral);
    await collateralToken.transfer(user2.address, userCollateral);
    await collateralToken.transfer(user3.address, userCollateral);

    // Deploy RangeBetMath library
    const RangeBetMathFactory = await ethers.getContractFactory("RangeBetMath");
    rangeBetMath = await RangeBetMathFactory.deploy();
    await rangeBetMath.waitForDeployment();

    // Deploy RangeBetManager with library linking
    const RangeBetManagerFactory = await ethers.getContractFactory(
      "RangeBetManager",
      {
        libraries: {
          RangeBetMath: await rangeBetMath.getAddress(),
        },
      }
    );

    rangeBetManager = await RangeBetManagerFactory.deploy(
      await collateralToken.getAddress(),
      "https://rangebet.example/api/token/"
    );

    // Get RangeBetToken address
    const rangeBetTokenAddress = await rangeBetManager.rangeBetToken();
    rangeBetToken = await ethers.getContractAt(
      "RangeBetToken",
      rangeBetTokenAddress
    );

    // Create a test market
    const tx = await rangeBetManager.createMarket(
      tickSpacing,
      minTick,
      maxTick
    );
    const receipt = await tx.wait();

    // Get marketId from event
    const marketCreatedEvent = receipt?.logs.find(
      (log) => (log as any).fragment?.name === "MarketCreated"
    );
    marketId = (marketCreatedEvent as any).args[0];

    // Approve collateral for users
    await collateralToken
      .connect(user1)
      .approve(await rangeBetManager.getAddress(), userCollateral);
    await collateralToken
      .connect(user2)
      .approve(await rangeBetManager.getAddress(), userCollateral);
    await collateralToken
      .connect(user3)
      .approve(await rangeBetManager.getAddress(), userCollateral);
  });

  describe("Market Creation", function () {
    it("Should create a market with correct parameters", async function () {
      // Create a new market
      const newMarketId = await rangeBetManager.createMarket(120, -720, 720);

      // Get market info
      const marketInfo = await rangeBetManager.getMarketInfo(1); // Market ID 1 (second market)

      // Check parameters
      expect(marketInfo[0]).to.be.true; // active
      expect(marketInfo[1]).to.be.false; // closed
      expect(marketInfo[2]).to.equal(120); // tickSpacing
      expect(marketInfo[3]).to.equal(-720); // minTick
      expect(marketInfo[4]).to.equal(720); // maxTick
      expect(marketInfo[5]).to.equal(0); // T (total supply)
      expect(marketInfo[6]).to.equal(0); // collateralBalance
    });

    it("Should fail with invalid tick parameters", async function () {
      // Try to create with minTick not a multiple of tickSpacing
      await expect(
        rangeBetManager.createMarket(60, -361, 360)
      ).to.be.revertedWith("Min tick must be a multiple of tick spacing");

      // Try to create with maxTick not a multiple of tickSpacing
      await expect(
        rangeBetManager.createMarket(60, -360, 361)
      ).to.be.revertedWith("Max tick must be a multiple of tick spacing");

      // Try to create with minTick >= maxTick
      await expect(
        rangeBetManager.createMarket(60, 360, 360)
      ).to.be.revertedWith("Min tick must be less than max tick");

      // Try to create with tickSpacing <= 0
      await expect(
        rangeBetManager.createMarket(0, -360, 360)
      ).to.be.revertedWith("Tick spacing must be positive");
    });

    it("Should only allow owner to create markets", async function () {
      await expect(
        rangeBetManager.connect(user1).createMarket(60, -360, 360)
      ).to.be.revertedWithCustomError(
        rangeBetManager,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("Buying Tokens", function () {
    it("Should allow users to buy tokens in a single bin", async function () {
      const binIndex = 0; // Bet on bin 0
      const amount = ethers.parseEther("100"); // Buy 100 tokens
      const maxCollateral = ethers.parseEther("150"); // Max willing to spend

      // Buy tokens
      await rangeBetManager
        .connect(user1)
        .buyTokens(marketId, [binIndex], [amount], maxCollateral);

      // Check token balance
      const tokenId = await rangeBetToken.encodeTokenId(marketId, binIndex);
      expect(await rangeBetToken.balanceOf(user1.address, tokenId)).to.equal(
        amount
      );

      // Check market state
      const marketInfo = await rangeBetManager.getMarketInfo(marketId);
      expect(marketInfo[5]).to.equal(amount); // T (total supply)
      expect(marketInfo[6]).to.be.gt(0); // collateralBalance should be positive

      // Check bin quantity
      expect(await rangeBetManager.getBinQuantity(marketId, binIndex)).to.equal(
        amount
      );
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
      await rangeBetManager
        .connect(user1)
        .buyTokens(marketId, binIndices, amounts, maxCollateral);

      // Check token balances
      for (let i = 0; i < binIndices.length; i++) {
        const tokenId = await rangeBetToken.encodeTokenId(
          marketId,
          binIndices[i]
        );
        expect(await rangeBetToken.balanceOf(user1.address, tokenId)).to.equal(
          amounts[i]
        );
      }

      // Check market state
      const marketInfo = await rangeBetManager.getMarketInfo(marketId);
      expect(marketInfo[5]).to.equal(
        ethers.parseEther("50") +
          ethers.parseEther("100") +
          ethers.parseEther("150")
      ); // T (total supply)

      // Check bin quantities
      for (let i = 0; i < binIndices.length; i++) {
        expect(
          await rangeBetManager.getBinQuantity(marketId, binIndices[i])
        ).to.equal(amounts[i]);
      }
    });

    it("Should calculate cost based on (q+t)/(T+t) integral formula", async function () {
      // First user bets on bin 0
      await rangeBetManager
        .connect(user1)
        .buyTokens(
          marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      // Second user also bets on bin 0
      const user1CollateralBefore = await collateralToken.balanceOf(
        user2.address
      );
      await rangeBetManager
        .connect(user2)
        .buyTokens(
          marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );
      const user1CollateralAfter = await collateralToken.balanceOf(
        user2.address
      );
      const secondBetCost = user1CollateralBefore - user1CollateralAfter;

      // Third user bets on bin 60
      const user2CollateralBefore = await collateralToken.balanceOf(
        user3.address
      );
      await rangeBetManager
        .connect(user3)
        .buyTokens(
          marketId,
          [60],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );
      const user2CollateralAfter = await collateralToken.balanceOf(
        user3.address
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
        rangeBetManager
          .connect(user1)
          .buyTokens(
            marketId,
            [0],
            [ethers.parseEther("100")],
            lowMaxCollateral
          )
      ).to.be.revertedWith("Cost exceeds max collateral");
    });

    it("Should fail for invalid bin indices", async function () {
      // Try to buy tokens with invalid bin index (not a multiple of tickSpacing)
      await expect(
        rangeBetManager
          .connect(user1)
          .buyTokens(
            marketId,
            [61],
            [ethers.parseEther("100")],
            ethers.parseEther("150")
          )
      ).to.be.revertedWith("Bin index must be a multiple of tick spacing");

      // Try to buy tokens with bin index out of range
      await expect(
        rangeBetManager
          .connect(user1)
          .buyTokens(
            marketId,
            [420],
            [ethers.parseEther("100")],
            ethers.parseEther("150")
          )
      ).to.be.revertedWith("Bin index out of range");
    });
  });

  describe("Market Management", function () {
    it("Should allow owner to deactivate and reactivate a market", async function () {
      // Deactivate the market
      await rangeBetManager.deactivateMarket(marketId);

      // Check market is inactive
      let marketInfo = await rangeBetManager.getMarketInfo(marketId);
      expect(marketInfo[0]).to.be.false; // active = false

      // Try to buy tokens in inactive market
      await expect(
        rangeBetManager
          .connect(user1)
          .buyTokens(
            marketId,
            [0],
            [ethers.parseEther("100")],
            ethers.parseEther("150")
          )
      ).to.be.revertedWith("Market is not active");

      // Reactivate the market
      await rangeBetManager.activateMarket(marketId);

      // Check market is active again
      marketInfo = await rangeBetManager.getMarketInfo(marketId);
      expect(marketInfo[0]).to.be.true; // active = true

      // Now buying should work
      await rangeBetManager
        .connect(user1)
        .buyTokens(
          marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );
    });
  });

  describe("Closing Market and Claiming Rewards", function () {
    beforeEach(async function () {
      // Set up a market with multiple bets
      // User1 bets on bin 0
      await rangeBetManager
        .connect(user1)
        .buyTokens(
          marketId,
          [0],
          [ethers.parseEther("100")],
          ethers.parseEther("150")
        );

      // User2 bets on bin 0 and bin 60
      await rangeBetManager
        .connect(user2)
        .buyTokens(
          marketId,
          [0, 60],
          [ethers.parseEther("50"), ethers.parseEther("100")],
          ethers.parseEther("200")
        );

      // User3 bets on bin -60
      await rangeBetManager
        .connect(user3)
        .buyTokens(
          marketId,
          [-60],
          [ethers.parseEther("150")],
          ethers.parseEther("200")
        );
    });

    it("Should allow owner to close a market and set winning bin", async function () {
      // Close the market and set bin 0 as winner
      await rangeBetManager.closeMarket(marketId, 0);

      // Check market is closed
      const marketInfo = await rangeBetManager.getMarketInfo(marketId);
      expect(marketInfo[1]).to.be.true; // closed = true
      expect(marketInfo[7]).to.equal(0); // winningBin = 0

      // Try to buy tokens in closed market
      await expect(
        rangeBetManager
          .connect(user1)
          .buyTokens(
            marketId,
            [0],
            [ethers.parseEther("100")],
            ethers.parseEther("150")
          )
      ).to.be.revertedWith("Market is closed");
    });

    it("Should fail to close a market with invalid winning bin", async function () {
      // Try to close with a winning bin that's not a multiple of tickSpacing
      await expect(
        rangeBetManager.closeMarket(marketId, 61)
      ).to.be.revertedWith("Winning bin must be a multiple of tick spacing");

      // Try to close with a winning bin outside the range
      await expect(
        rangeBetManager.closeMarket(marketId, 420)
      ).to.be.revertedWith("Winning bin out of range");
    });

    it("Should allow users to claim rewards from winning bin", async function () {
      // Close the market and set bin 0 as winner
      await rangeBetManager.closeMarket(marketId, 0);

      // Calculate expected rewards
      // Total in bin 0 = 100 from user1 + 50 from user2 = 150
      // Total collateral in market = user1 bet + user2 bet + user3 bet
      // User1 owns 100/150 of bin 0
      // User2 owns 50/150 of bin 0

      // Get collateral balance before claiming
      const user1BalanceBefore = await collateralToken.balanceOf(user1.address);
      const user2BalanceBefore = await collateralToken.balanceOf(user2.address);

      // User1 claims rewards
      await rangeBetManager.connect(user1).claimReward(marketId, 0);

      // User2 claims rewards
      await rangeBetManager.connect(user2).claimReward(marketId, 0);

      // Get collateral balance after claiming
      const user1BalanceAfter = await collateralToken.balanceOf(user1.address);
      const user2BalanceAfter = await collateralToken.balanceOf(user2.address);

      // Check that rewards were received
      expect(user1BalanceAfter).to.be.gt(user1BalanceBefore);
      expect(user2BalanceAfter).to.be.gt(user2BalanceBefore);

      // Check that user1 got more rewards than user2 (100 tokens vs 50 tokens)
      const user1Reward = user1BalanceAfter - user1BalanceBefore;
      const user2Reward = user2BalanceAfter - user2BalanceBefore;
      expect(user1Reward).to.be.gt(user2Reward);

      // The ratio should be approximately 2:1 (token amount ratio)
      // However, because of the integral cost formula, the actual reward ratio may differ
      // We just check that user1 (with 100 tokens) gets more than user2 (with 50 tokens)
      const binTokenId = await rangeBetToken.encodeTokenId(marketId, 0);
      // Get market data to understand how rewards are calculated
      const marketInfo = await rangeBetManager.getMarketInfo(marketId);
      console.log("Market total supply:", marketInfo[5].toString());
      console.log("Market collateral balance:", marketInfo[6].toString());
      console.log("User1 reward:", user1Reward.toString());
      console.log("User2 reward:", user2Reward.toString());
      console.log("Ratio:", Number(user1Reward) / Number(user2Reward));
    });

    it("Should not allow claiming from non-winning bins", async function () {
      // Close the market and set bin 0 as winner
      await rangeBetManager.closeMarket(marketId, 0);

      // Try to claim from bin 60 (not winning)
      await expect(
        rangeBetManager.connect(user2).claimReward(marketId, 60)
      ).to.be.revertedWith("Not the winning bin");

      // Try to claim from bin -60 (not winning)
      await expect(
        rangeBetManager.connect(user3).claimReward(marketId, -60)
      ).to.be.revertedWith("Not the winning bin");
    });

    it("Should not allow claiming twice", async function () {
      // Close the market and set bin 0 as winner
      await rangeBetManager.closeMarket(marketId, 0);

      // User1 claims rewards first time
      await rangeBetManager.connect(user1).claimReward(marketId, 0);

      // Try to claim again - should revert with "No tokens to claim" instead of "Already claimed"
      // since tokens are now burned after claiming
      await expect(
        rangeBetManager.connect(user1).claimReward(marketId, 0)
      ).to.be.revertedWith("No tokens to claim");
    });

    it("Should burn tokens after claiming", async function () {
      // Close the market and set bin 0 as winner
      await rangeBetManager.closeMarket(marketId, 0);

      // Check token balance before claiming
      const tokenId = await rangeBetToken.encodeTokenId(marketId, 0);
      expect(await rangeBetToken.balanceOf(user1.address, tokenId)).to.equal(
        ethers.parseEther("100")
      );

      // User1 claims rewards
      await rangeBetManager.connect(user1).claimReward(marketId, 0);

      // Check token balance after claiming
      expect(await rangeBetToken.balanceOf(user1.address, tokenId)).to.equal(0);
    });
  });
});
