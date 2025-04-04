import { ethers } from "hardhat";

async function main() {
  console.log("Interacting with deployed contracts...");

  // Get signers
  const [owner, user1, user2] = await ethers.getSigners();
  console.log("Using accounts:");
  console.log("Owner:", owner.address);
  console.log("User1:", user1.address);
  console.log("User2:", user2.address);

  // Get contract instances using the deployed addresses
  const rangeBetManager = await ethers.getContractAt(
    "RangeBetManager",
    "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
  );

  const rangeBetToken = await ethers.getContractAt(
    "RangeBetToken",
    "0x75537828f2ce51be7289709686A69CbFDbB714F1"
  );

  const collateralToken = await ethers.getContractAt(
    "MockCollateralToken",
    "0x5FbDB2315678afecb367f032d93F642f64180aa3"
  );

  // Check market info
  console.log("\n--- Market Info ---");
  const marketInfo = await rangeBetManager.getMarketInfo(0);
  console.log("Active:", marketInfo[0]);
  console.log("Closed:", marketInfo[1]);
  console.log("Tick Spacing:", marketInfo[2].toString());
  console.log("Min Tick:", marketInfo[3].toString());
  console.log("Max Tick:", marketInfo[4].toString());
  console.log("Total Supply:", marketInfo[5].toString());
  console.log("Collateral Balance:", marketInfo[6].toString());

  // Transfer collateral to users for betting
  const userCollateral = ethers.parseEther("1000");
  await collateralToken.transfer(user1.address, userCollateral);
  await collateralToken.transfer(user2.address, userCollateral);
  console.log("\n--- Transferred Collateral ---");
  console.log(
    "User1 Balance:",
    (await collateralToken.balanceOf(user1.address)).toString()
  );
  console.log(
    "User2 Balance:",
    (await collateralToken.balanceOf(user2.address)).toString()
  );

  // Approve collateral for users
  await collateralToken
    .connect(user1)
    .approve(await rangeBetManager.getAddress(), userCollateral);
  await collateralToken
    .connect(user2)
    .approve(await rangeBetManager.getAddress(), userCollateral);
  console.log("Approved collateral for users");

  // User1 buys tokens in bin 0
  console.log("\n--- User1 Betting ---");
  const user1Amount = ethers.parseEther("100");
  const maxCollateral1 = ethers.parseEther("150");
  await rangeBetManager.connect(user1).buyTokens(
    0, // marketId
    [0], // bin 0
    [user1Amount], // 100 tokens
    maxCollateral1
  );
  console.log("User1 bet on bin 0");

  // User2 buys tokens in bins -60 and 60
  console.log("\n--- User2 Betting ---");
  const user2Amounts = [ethers.parseEther("50"), ethers.parseEther("50")];
  const maxCollateral2 = ethers.parseEther("150");
  await rangeBetManager.connect(user2).buyTokens(
    0, // marketId
    [-60, 60], // bins -60 and 60
    user2Amounts, // 50 tokens each
    maxCollateral2
  );
  console.log("User2 bet on bins -60 and 60");

  // Check token balances
  console.log("\n--- Token Balances ---");
  const tokenId0 = await rangeBetToken.encodeTokenId(0, 0);
  const tokenIdMinus60 = await rangeBetToken.encodeTokenId(0, -60);
  const tokenId60 = await rangeBetToken.encodeTokenId(0, 60);

  console.log(
    "User1 Bin 0:",
    (await rangeBetToken.balanceOf(user1.address, tokenId0)).toString()
  );
  console.log(
    "User2 Bin -60:",
    (await rangeBetToken.balanceOf(user2.address, tokenIdMinus60)).toString()
  );
  console.log(
    "User2 Bin 60:",
    (await rangeBetToken.balanceOf(user2.address, tokenId60)).toString()
  );

  // Updated market info
  console.log("\n--- Updated Market Info ---");
  const updatedMarketInfo = await rangeBetManager.getMarketInfo(0);
  console.log("Total Supply:", updatedMarketInfo[5].toString());
  console.log("Collateral Balance:", updatedMarketInfo[6].toString());
  console.log(
    "Bin 0 Quantity:",
    (await rangeBetManager.getBinQuantity(0, 0)).toString()
  );
  console.log(
    "Bin -60 Quantity:",
    (await rangeBetManager.getBinQuantity(0, -60)).toString()
  );
  console.log(
    "Bin 60 Quantity:",
    (await rangeBetManager.getBinQuantity(0, 60)).toString()
  );

  // Close market with bin 0 as the winner
  console.log("\n--- Closing Market ---");
  await rangeBetManager.closeMarket(0, 0);
  console.log("Market closed with bin 0 as the winner");

  // User1 claims rewards
  console.log("\n--- User1 Claims Reward ---");
  const user1BalanceBefore = await collateralToken.balanceOf(user1.address);
  await rangeBetManager.connect(user1).claimReward(0, 0);
  const user1BalanceAfter = await collateralToken.balanceOf(user1.address);
  const user1Reward = user1BalanceAfter - user1BalanceBefore;
  console.log("User1 Reward:", user1Reward.toString());

  // User2 tries to claim rewards from the wrong bin (should fail)
  console.log("\n--- User2 Claims from Wrong Bin ---");
  try {
    await rangeBetManager.connect(user2).claimReward(0, 60);
    console.log("This should not succeed");
  } catch (error) {
    console.log("Error as expected: User2 tried to claim from non-winning bin");
  }

  // Final state
  console.log("\n--- Final State ---");
  const finalMarketInfo = await rangeBetManager.getMarketInfo(0);
  console.log("Market Closed:", finalMarketInfo[1]);
  console.log("Winning Bin:", finalMarketInfo[7].toString());
  console.log("Remaining Collateral Balance:", finalMarketInfo[6].toString());
  console.log(
    "User1 Token Balance Bin 0:",
    (await rangeBetToken.balanceOf(user1.address, tokenId0)).toString()
  );
}

// Execute script and handle errors
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
