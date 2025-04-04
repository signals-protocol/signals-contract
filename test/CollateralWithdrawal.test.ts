import { expect } from "chai";
import { ethers } from "hardhat";
import { setupTestEnvironment } from "./setupTests";
import { parseEther } from "ethers";

describe("Collateral Withdrawal", function () {
  it("Owner should be able to withdraw all collateral", async function () {
    const { rangeBetManager, collateralToken, owner, user1, marketId } =
      await setupTestEnvironment();

    // User buys tokens to add collateral to the contract
    const binIndices = [-60, 0, 60];
    const amounts = [parseEther("100"), parseEther("200"), parseEther("100")];
    const maxCollateral = parseEther("10000");

    await rangeBetManager
      .connect(user1)
      .buyTokens(marketId, binIndices, amounts, maxCollateral);

    // Check contract has collateral
    const contractAddress = await rangeBetManager.getAddress();
    const initialBalance = await collateralToken.balanceOf(contractAddress);
    expect(initialBalance).to.be.gt(0);

    // Check owner's balance before withdrawal
    const ownerBalanceBefore = await collateralToken.balanceOf(owner.address);

    // Owner withdraws all collateral
    await rangeBetManager.withdrawAllCollateral(owner.address);

    // Contract balance should be 0 after withdrawal
    const finalContractBalance = await collateralToken.balanceOf(
      contractAddress
    );
    expect(finalContractBalance).to.equal(0);

    // Owner's balance should increase by the amount withdrawn
    const ownerBalanceAfter = await collateralToken.balanceOf(owner.address);
    expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + initialBalance);
  });

  it("Non-owner should not be able to withdraw collateral", async function () {
    const { rangeBetManager, user1 } = await setupTestEnvironment();

    // Non-owner attempts to withdraw, should revert
    await expect(
      rangeBetManager.connect(user1).withdrawAllCollateral(user1.address)
    ).to.be.revertedWithCustomError(
      rangeBetManager,
      "OwnableUnauthorizedAccount"
    );
  });

  it("Should emit CollateralWithdrawn event", async function () {
    const { rangeBetManager, collateralToken, owner, user1, marketId } =
      await setupTestEnvironment();

    // User buys tokens to add collateral to the contract
    const binIndices = [-60, 0, 60];
    const amounts = [parseEther("100"), parseEther("200"), parseEther("100")];
    const maxCollateral = parseEther("10000");

    await rangeBetManager
      .connect(user1)
      .buyTokens(marketId, binIndices, amounts, maxCollateral);

    // Get contract balance
    const contractAddress = await rangeBetManager.getAddress();
    const balance = await collateralToken.balanceOf(contractAddress);

    // Verify event emission
    await expect(rangeBetManager.withdrawAllCollateral(owner.address))
      .to.emit(rangeBetManager, "CollateralWithdrawn")
      .withArgs(owner.address, balance);
  });

  it("Should revert when there is no collateral to withdraw", async function () {
    // Create a new test environment without buying any tokens
    const { rangeBetManager, owner } = await setupTestEnvironment();

    // Make sure the market is created but no tokens bought
    // Contract should have 0 collateral

    // Attempt to withdraw should revert
    await expect(
      rangeBetManager.withdrawAllCollateral(owner.address)
    ).to.be.revertedWith("No collateral to withdraw");
  });
});
