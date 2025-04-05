import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";

// Load .env file
dotenv.config();

async function main() {
  console.log("Betting on multiple markets...");
  console.log("Network:", network.name);

  // Set addresses according to network
  let rangeBetManagerAddress = "";
  let rangeBetTokenAddress = "";
  let collateralTokenAddress = "";

  if (network.name === "localhost") {
    // Local deployment addresses (values from deploy:local output)
    rangeBetManagerAddress = "0x0B306BF915C4d645ff596e518fAf3F9669b97016";
    rangeBetTokenAddress = "0x524F04724632eED237cbA3c37272e018b3A7967e";
    collateralTokenAddress = "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82";
  } else if (network.name === "rskTestnet") {
    // For RSK Testnet, use environment variables
    rangeBetManagerAddress = process.env.RSK_RANGE_BET_MANAGER || "";
    rangeBetTokenAddress = process.env.RSK_RANGE_BET_TOKEN || "";
    collateralTokenAddress = process.env.RSK_COLLATERAL_TOKEN || "";

    if (
      !rangeBetManagerAddress ||
      !rangeBetTokenAddress ||
      !collateralTokenAddress
    ) {
      console.error("RSK contract addresses are not set in the .env file");
      process.exit(1);
    }
  } else {
    // For other networks, check if environment variables exist
    console.error(
      `Contract addresses for network '${network.name}' are not configured`
    );
    process.exit(1);
  }

  console.log("Using contract addresses:");
  console.log("Network:", network.name);
  console.log("RangeBetManager:", rangeBetManagerAddress);
  console.log("RangeBetToken:", rangeBetTokenAddress);
  console.log("CollateralToken:", collateralTokenAddress);

  // Get signers
  const signers = await ethers.getSigners();
  const owner = signers[0];
  // Use owner as user (if there's no second user)
  const user = signers.length > 1 ? signers[1] : owner;

  console.log("\nUsing accounts:");
  console.log("Owner:", owner.address);
  console.log("User:", user.address);

  // Get contract instances using the deployed addresses
  const rangeBetManager = await ethers.getContractAt(
    "RangeBetManager",
    rangeBetManagerAddress
  );

  const rangeBetToken = await ethers.getContractAt(
    "RangeBetToken",
    rangeBetTokenAddress
  );

  const collateralToken = await ethers.getContractAt(
    "MockCollateralToken",
    collateralTokenAddress
  );

  // Transfer 10,000 collateral tokens to the user
  const collateralAmount = ethers.parseEther("10000");

  // Only transfer if owner and user are different
  if (owner.address !== user.address) {
    await collateralToken.transfer(user.address, collateralAmount);
    console.log("\n--- Transferred Collateral ---");
    console.log(
      "User Balance:",
      (await collateralToken.balanceOf(user.address)).toString()
    );
  } else {
    console.log("\n--- Using Owner as User ---");
    console.log(
      "Owner/User Balance:",
      (await collateralToken.balanceOf(owner.address)).toString()
    );
  }

  // User approves collateral usage for RangeBetManager
  await collateralToken
    .connect(user)
    .approve(await rangeBetManager.getAddress(), collateralAmount);
  console.log("Approved collateral for betting");

  // List of market IDs to bet on
  const marketIds = [5, 10, 15, 20, 25, 30];

  // Bet on each market
  console.log("\n--- Placing Bets ---");

  for (const marketId of marketIds) {
    try {
      // Check market info
      const marketInfo = await rangeBetManager.getMarketInfo(marketId);
      const active = marketInfo[0];
      const closed = marketInfo[1];
      const tickSpacing = marketInfo[2];

      // Check if market is active
      if (!active || closed) {
        console.log(
          `Market ${marketId} is not active or already closed. Skipping...`
        );
        continue;
      }

      // Randomly select a bin that's a multiple of tickSpacing in the range of 80k-90k
      // Choose a random value in the range divided by tickSpacing, then multiply by tickSpacing again
      const minTick = 0;
      const maxTick = 2400;

      // Random selection of multiple of 60 in the range
      const minBinIndex = Math.ceil(minTick / Number(tickSpacing)); // Ceiling
      const maxBinIndex = Math.floor(maxTick / Number(tickSpacing)); // Floor
      const randomBinIndex =
        Math.floor(Math.random() * (maxBinIndex - minBinIndex + 1)) +
        minBinIndex;
      const selectedBin = randomBinIndex * Number(tickSpacing);

      // Token amount for each bet
      const betAmount = ethers.parseEther("10");

      // Maximum collateral amount with sufficient margin
      const maxCollateral = ethers.parseEther("20");

      console.log(
        `Betting on Market ${marketId}, Bin ${selectedBin} with ${betAmount} tokens...`
      );

      // Execute the bet
      const tx = await rangeBetManager.connect(user).buyTokens(
        marketId,
        [selectedBin], // Selected bin
        [betAmount], // 10 tokens
        maxCollateral
      );

      const receipt = await tx.wait();
      if (!receipt) {
        console.error(
          "Transaction receipt is null. Transaction may have failed."
        );
        continue;
      }

      // Log transaction details
      console.log(`Transaction Hash: ${receipt.hash}`);
      console.log(`Block Number: ${receipt.blockNumber}`);

      // Confirm bet
      const tokenId = await rangeBetToken.encodeTokenId(marketId, selectedBin);
      const userBalance = await rangeBetToken.balanceOf(user.address, tokenId);

      console.log(
        `✅ Bet placed successfully on Market ${marketId}, Bin ${selectedBin}`
      );
      console.log(`   User Token Balance: ${userBalance}`);
    } catch (error: any) {
      console.error(
        `❌ Failed to bet on Market ${marketId}: ${error?.message || error}`
      );
    }
  }

  // Check remaining collateral
  const remainingBalance = await collateralToken.balanceOf(user.address);
  console.log("\n--- Betting Complete ---");
  console.log(`Remaining Collateral Balance: ${remainingBalance}`);
}

// Execute script and handle errors
main().catch((error: any) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
