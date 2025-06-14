import { ethers } from "hardhat";
import {
  RangeBetManager,
  RangeBetToken,
  MockCollateralToken,
  RangeBetMath,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

export async function setupTestEnvironment() {
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
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  // Market parameters
  const tickSpacing = 60;
  const minTick = -360;
  const maxTick = 360;
  let marketId: bigint;
  // Expected market close time: current time + 7 days
  const closeTime = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);

  // Initial collateral amounts
  const initialCollateral = ethers.parseEther("1000000");
  const userCollateral = ethers.parseEther("10000");

  // Get signers
  [owner, user1, user2, user3, user4, user5] = await ethers.getSigners();

  // Deploy collateral token
  const MockCollateralToken = await ethers.getContractFactory(
    "MockCollateralToken"
  );
  collateralToken = await MockCollateralToken.deploy(
    "Mock Collateral",
    "MCOL",
    initialCollateral
  );

  // Users claim free mint and get additional tokens from owner
  await collateralToken.connect(user1).claimFreeMint();
  await collateralToken.connect(user2).claimFreeMint();
  await collateralToken.connect(user3).claimFreeMint();
  await collateralToken.connect(user4).claimFreeMint();
  await collateralToken.connect(user5).claimFreeMint();

  // Owner mints additional tokens to users for testing
  const freeMintAmount = await collateralToken.freeMintAmount();
  await collateralToken.mintTo(user1.address, userCollateral - freeMintAmount);
  await collateralToken.mintTo(user2.address, userCollateral - freeMintAmount);
  await collateralToken.mintTo(user3.address, userCollateral - freeMintAmount);
  // User4 gets very small amount for testing insufficient balance scenario (only free mint)
  await collateralToken.mintTo(user5.address, userCollateral - freeMintAmount);

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
    maxTick,
    closeTime
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
  // User4 approves more than their balance
  await collateralToken
    .connect(user4)
    .approve(await rangeBetManager.getAddress(), ethers.parseEther("1000"));
  // User5 approves limited amount
  await collateralToken
    .connect(user5)
    .approve(await rangeBetManager.getAddress(), ethers.parseEther("10"));

  return {
    rangeBetManager,
    rangeBetToken,
    collateralToken,
    rangeBetMath,
    owner,
    user1,
    user2,
    user3,
    user4,
    user5,
    marketId,
    tickSpacing,
    minTick,
    maxTick,
    closeTime,
    initialCollateral,
    userCollateral,
  };
}
