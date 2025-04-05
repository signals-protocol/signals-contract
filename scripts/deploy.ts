import { ethers, network } from "hardhat";

async function main() {
  console.log("Deployment started...");
  console.log("Network:", network.name);

  // Deploy a mock ERC20 token to use as collateral
  console.log("Deploying MockCollateralToken...");
  const MockToken = await ethers.getContractFactory("MockCollateralToken");
  const collateralToken = await MockToken.deploy(
    "Mock Collateral",
    "MCOL",
    ethers.parseEther("100000000000000")
  );

  // Wait for deployment and get transaction receipt
  const deployTx = collateralToken.deploymentTransaction();
  if (!deployTx) throw new Error("Deploy transaction is null");
  const collateralTokenReceipt = await deployTx.wait();
  const collateralTokenAddress = await collateralToken.getAddress();

  console.log("MockCollateralToken deployed to:", collateralTokenAddress);
  console.log("Transaction Hash:", collateralTokenReceipt?.hash || "unknown");
  console.log(
    "Block Number:",
    collateralTokenReceipt?.blockNumber || "unknown"
  );

  // Deploy RangeBetMath library
  console.log("\nDeploying RangeBetMath library...");
  const RangeBetMathFactory = await ethers.getContractFactory("RangeBetMath");
  const rangeBetMath = await RangeBetMathFactory.deploy();

  // Wait for deployment and get transaction receipt
  const mathDeployTx = rangeBetMath.deploymentTransaction();
  if (!mathDeployTx) throw new Error("Deploy transaction is null");
  const rangeBetMathReceipt = await mathDeployTx.wait();
  const rangeBetMathAddress = await rangeBetMath.getAddress();

  console.log("RangeBetMath deployed to:", rangeBetMathAddress);
  console.log("Transaction Hash:", rangeBetMathReceipt?.hash || "unknown");
  console.log("Block Number:", rangeBetMathReceipt?.blockNumber || "unknown");

  // Deploy RangeBetManager with library linking
  console.log("\nDeploying RangeBetManager...");
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

  // Wait for deployment and get transaction receipt
  const managerDeployTx = rangeBetManager.deploymentTransaction();
  if (!managerDeployTx) throw new Error("Deploy transaction is null");
  const rangeBetManagerReceipt = await managerDeployTx.wait();
  const rangeBetManagerAddress = await rangeBetManager.getAddress();

  console.log("RangeBetManager deployed to:", rangeBetManagerAddress);
  console.log("Transaction Hash:", rangeBetManagerReceipt?.hash || "unknown");
  console.log(
    "Block Number:",
    rangeBetManagerReceipt?.blockNumber || "unknown"
  );

  // Store block numbers for summary
  const collateralTokenBlockNumber =
    collateralTokenReceipt?.blockNumber || "unknown";
  const rangeBetMathBlockNumber = rangeBetMathReceipt?.blockNumber || "unknown";
  const rangeBetManagerBlockNumber =
    rangeBetManagerReceipt?.blockNumber || "unknown";

  try {
    // Try to get the RangeBetToken address
    // This might fail if the contract interface doesn't match TypeScript expectations
    const rangeBetTokenAddress = await rangeBetManager.rangeBetToken();
    console.log("\nRangeBetToken deployed to:", rangeBetTokenAddress);
    console.log(
      "Note: RangeBetToken is created during RangeBetManager deployment"
    );
    console.log(
      "Block Number:",
      rangeBetManagerBlockNumber,
      "(same as RangeBetManager)"
    );

    // Note: Sample market creation has been removed
    // Markets will be created separately using the createBatchMarkets function
    console.log(
      "\nDeployment completed successfully without creating any markets."
    );
    console.log("To create markets, use the createMultipleMarkets script.");
  } catch (error) {
    console.error("Error with contract interaction:", error);
    console.log(
      "Note: TypeScript types might not match the actual contract. This is expected during development."
    );
  }

  // Output deployment information
  console.log("\n--------------------");
  console.log("Deployment Information Summary:");
  console.log("Network:", network.name);
  console.log(
    "Collateral Token:",
    collateralTokenAddress,
    `(Block #${collateralTokenBlockNumber})`
  );
  console.log(
    "RangeBetMath Library:",
    rangeBetMathAddress,
    `(Block #${rangeBetMathBlockNumber})`
  );
  console.log(
    "RangeBetManager:",
    rangeBetManagerAddress,
    `(Block #${rangeBetManagerBlockNumber})`
  );
  try {
    console.log(
      "RangeBetToken:",
      await rangeBetManager.rangeBetToken(),
      `(Block #${rangeBetManagerBlockNumber})`
    );
  } catch (error) {
    console.log("RangeBetToken: Unable to retrieve address");
  }
  console.log("--------------------");
}

// Execute script and handle errors
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
