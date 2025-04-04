import { ethers, network } from "hardhat";

async function main() {
  console.log("Deployment started...");

  // Deploy a mock ERC20 token to use as collateral
  console.log("Deploying MockCollateralToken...");
  const MockToken = await ethers.getContractFactory("MockCollateralToken");
  const collateralToken = await MockToken.deploy(
    "Mock Collateral",
    "MCOL",
    ethers.parseEther("10000000")
  );
  await collateralToken.waitForDeployment();
  const collateralTokenAddress = await collateralToken.getAddress();
  console.log("MockCollateralToken deployed to:", collateralTokenAddress);

  // Deploy RangeBetMath library
  console.log("Deploying RangeBetMath library...");
  const RangeBetMathFactory = await ethers.getContractFactory("RangeBetMath");
  const rangeBetMath = await RangeBetMathFactory.deploy();
  await rangeBetMath.waitForDeployment();
  const rangeBetMathAddress = await rangeBetMath.getAddress();
  console.log("RangeBetMath deployed to:", rangeBetMathAddress);

  // Deploy RangeBetManager with library linking
  console.log("Deploying RangeBetManager...");
  const RangeBetManagerFactory = await ethers.getContractFactory(
    "RangeBetManager",
    {
      libraries: {
        RangeBetMath: rangeBetMathAddress,
      },
    }
  );

  const baseURI = "https://rangebet.example/api/token/";
  const rangeBetManager = await RangeBetManagerFactory.deploy(
    collateralTokenAddress,
    baseURI
  );
  await rangeBetManager.waitForDeployment();
  const rangeBetManagerAddress = await rangeBetManager.getAddress();
  console.log("RangeBetManager deployed to:", rangeBetManagerAddress);

  try {
    // Try to get the RangeBetToken address
    // This might fail if the contract interface doesn't match TypeScript expectations
    const rangeBetTokenAddress = await rangeBetManager.rangeBetToken();
    console.log("RangeBetToken deployed to:", rangeBetTokenAddress);

    // Create a sample market
    console.log("Creating a sample market...");
    const tickSpacing = 60;
    const minTick = -360;
    const maxTick = 360;

    const createMarketTx = await rangeBetManager.createMarket(
      tickSpacing,
      minTick,
      maxTick
    );
    await createMarketTx.wait();
    console.log("Sample market created with parameters:");
    console.log("- tickSpacing:", tickSpacing);
    console.log("- minTick:", minTick);
    console.log("- maxTick:", maxTick);
  } catch (error) {
    console.error("Error with contract interaction:", error);
    console.log(
      "Note: TypeScript types might not match the actual contract. This is expected during development."
    );
  }

  // Output deployment information
  console.log("--------------------");
  console.log("Deployment Information:");
  console.log("Network:", network.name);
  console.log("Collateral Token:", collateralTokenAddress);
  console.log("RangeBetMath Library:", rangeBetMathAddress);
  console.log("RangeBetManager:", rangeBetManagerAddress);
  console.log("--------------------");
}

// Execute script and handle errors
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
