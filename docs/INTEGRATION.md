# RangeBet Integration Guide

This document is a guide for developers looking to integrate with the RangeBet prediction market system.

## Table of Contents

1. [Overview](#overview)
2. [Contract Addresses](#contract-addresses)
3. [JavaScript/TypeScript Integration](#javascripttypescript-integration)
4. [Smart Contract Integration](#smart-contract-integration)
5. [Event Monitoring](#event-monitoring)
6. [Error Handling](#error-handling)
7. [Test Environment](#test-environment)

## Overview

The RangeBet system consists of the following core contracts:

- **RangeBetManager**: Contract for market creation and management
- **RangeBetToken**: ERC1155 token contract
- **RangeBetMath**: Betting cost calculation library
- **Collateral Token**: ERC20 token used in the system

This guide shows how to integrate with the RangeBet system from a frontend or another smart contract.

## Contract Addresses

### Testnet (Sepolia)

```
RangeBetManager: 0x...
RangeBetToken: 0x...
Collateral Token (Mock): 0x...
```

### Mainnet

```
Not yet deployed
```

## JavaScript/TypeScript Integration

### Required Dependencies

```bash
npm install ethers@6.4.0
# or
yarn add ethers@6.4.0
```

### Setting Up Contract Interfaces

```typescript
import { ethers } from "ethers";

// Import ABI files
import RangeBetManagerABI from "./abis/RangeBetManager.json";
import RangeBetTokenABI from "./abis/RangeBetToken.json";
import ERC20ABI from "./abis/ERC20.json";

// Contract addresses
const MANAGER_ADDRESS = "0x...";
const TOKEN_ADDRESS = "0x...";
const COLLATERAL_ADDRESS = "0x...";

// Set up provider
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// Create contract instances
const managerContract = new ethers.Contract(
  MANAGER_ADDRESS,
  RangeBetManagerABI,
  signer
);

const tokenContract = new ethers.Contract(
  TOKEN_ADDRESS,
  RangeBetTokenABI,
  signer
);

const collateralContract = new ethers.Contract(
  COLLATERAL_ADDRESS,
  ERC20ABI,
  signer
);
```

### Market Queries

```typescript
async function getMarketInfo(marketId: number) {
  const marketInfo = await managerContract.getMarketInfo(marketId);

  return {
    active: marketInfo[0],
    closed: marketInfo[1],
    tickSpacing: marketInfo[2],
    minTick: marketInfo[3],
    maxTick: marketInfo[4],
    totalSupply: marketInfo[5],
    collateralBalance: marketInfo[6],
    winningBin: marketInfo[7],
    openTimestamp: marketInfo[8],
    closeTimestamp: marketInfo[9],
  };
}

// Query token quantity for a specific bin
async function getBinQuantity(marketId: number, binIndex: number) {
  return await managerContract.getBinQuantity(marketId, binIndex);
}

// Query user's token balance
async function getUserTokenBalance(
  marketId: number,
  binIndex: number,
  userAddress: string
) {
  const tokenId = await tokenContract.encodeTokenId(marketId, binIndex);
  return await tokenContract.balanceOf(userAddress, tokenId);
}
```

### Betting (Token Purchase)

```typescript
async function placeBet(
  marketId: number,
  binIndices: number[],
  amounts: string[],
  maxCollateral: string
) {
  // Approve collateral token (first transaction)
  const approveTx = await collateralContract.approve(
    MANAGER_ADDRESS,
    ethers.parseUnits(maxCollateral, 18)
  );
  await approveTx.wait();

  // Buy tokens (second transaction)
  const buyTx = await managerContract.buyTokens(
    marketId,
    binIndices,
    amounts.map((a) => ethers.parseUnits(a, 18)),
    ethers.parseUnits(maxCollateral, 18)
  );

  return await buyTx.wait();
}
```

### Claiming Rewards

```typescript
async function claimReward(marketId: number, binIndex: number) {
  const tx = await managerContract.claimReward(marketId, binIndex);
  return await tx.wait();
}
```

### Withdrawing All Collateral (Admin Only)

```typescript
async function withdrawAllCollateral(to: string) {
  // Can only be called by owner/admin
  const tx = await managerContract.withdrawAllCollateral(to);
  return await tx.wait();
}
```

## Smart Contract Integration

To integrate with RangeBet from another smart contract:

### Interface Definitions

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRangeBetManager {
    function createMarket(
        uint256 tickSpacing,
        int256 minTick,
        int256 maxTick,
        uint256 closeTime
    ) external returns (uint256);

    function buyTokens(
        uint256 marketId,
        int256[] calldata binIndices,
        uint256[] calldata amounts,
        uint256 maxCollateral
    ) external;

    function closeMarket(uint256 marketId, int256 winningBin) external;

    function claimReward(uint256 marketId, int256 binIndex) external;

    function getBinQuantity(uint256 marketId, int256 binIndex) external view returns (uint256);

    function getMarketInfo(uint256 marketId) external view returns (
        bool active,
        bool closed,
        uint256 tickSpacing,
        int256 minTick,
        int256 maxTick,
        uint256 T,
        uint256 collateralBalance,
        int256 winningBin,
        uint256 openTimestamp,
        uint256 closeTimestamp
    );

    function withdrawAllCollateral(address to) external;
}

interface IRangeBetToken {
    function encodeTokenId(uint256 marketId, int256 binIndex) external pure returns (uint256);
    function decodeTokenId(uint256 tokenId) external pure returns (uint256 marketId, int256 binIndex);
    function balanceOf(address account, uint256 id) external view returns (uint256);
}
```

### Contract Integration Example

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IRangeBetManager.sol";
import "./interfaces/IRangeBetToken.sol";

contract RangeBetIntegration {
    IRangeBetManager public rangeBetManager;
    IRangeBetToken public rangeBetToken;
    IERC20 public collateralToken;

    constructor(
        address _rangeBetManager,
        address _rangeBetToken,
        address _collateralToken
    ) {
        rangeBetManager = IRangeBetManager(_rangeBetManager);
        rangeBetToken = IRangeBetToken(_rangeBetToken);
        collateralToken = IERC20(_collateralToken);
    }
}
```

## Event Monitoring

The RangeBet system generates the following key events:

### RangeBetManager Events

```solidity
// Market creation event
event MarketCreated(uint256 indexed marketId, uint256 tickSpacing, int256 minTick, int256 maxTick, uint256 openTimestamp, uint256 closeTimestamp);

// Token purchase event
event TokensBought(
    uint256 indexed marketId,
    address indexed buyer,
    int256[] binIndices,
    uint256[] amounts,
    uint256 totalCost
);

// Market closure event
event MarketClosed(uint256 indexed marketId, int256 winningBin);

// Reward claiming event
event RewardClaimed(
    uint256 indexed marketId,
    address indexed claimer,
    int256 binIndex,
    uint256 amount
);

// Collateral withdrawal event
event CollateralWithdrawn(address indexed to, uint256 amount);
```

### Web Application Event Listening

```typescript
// Market creation event listening
managerContract.on(
  "MarketCreated",
  (
    marketId,
    tickSpacing,
    minTick,
    maxTick,
    openTimestamp,
    closeTimestamp,
    event
  ) => {
    console.log(`Market created: ID ${marketId}`);
    // UI update logic
  }
);

// Token purchase event listening
managerContract.on(
  "TokensBought",
  (marketId, buyer, binIndices, amounts, totalCost, event) => {
    console.log(`Tokens bought: Market ${marketId}, Buyer ${buyer}`);
    // UI update logic
  }
);

// Market closure event listening
managerContract.on("MarketClosed", (marketId, winningBin, event) => {
  console.log(`Market closed: ID ${marketId}, Winning bin ${winningBin}`);
  // UI update logic
});

// Reward claiming event listening
managerContract.on(
  "RewardClaimed",
  (marketId, claimer, binIndex, amount, event) => {
    console.log(
      `Reward claimed: Market ${marketId}, Claimer ${claimer}, Reward ${ethers.formatUnits(
        amount,
        18
      )}`
    );
    // UI update logic
  }
);
```

## Error Handling

The RangeBet system contracts can generate the following key errors:

```typescript
try {
  // Contract call
} catch (error: any) {
  const errorMessage = error.message;

  if (errorMessage.includes("Market is not active")) {
    // Market is not active
  } else if (errorMessage.includes("Market is already closed")) {
    // Market is already closed
  } else if (errorMessage.includes("Bin index out of range")) {
    // Bin index outside the allowed range
  } else if (
    errorMessage.includes("Bin index must be a multiple of tick spacing")
  ) {
    // Bin index not a multiple of tick spacing
  } else if (errorMessage.includes("Market is closed")) {
    // Market is closed, cannot place bets
  } else if (errorMessage.includes("Array lengths must match")) {
    // binIndices and amounts arrays must have the same length
  } else if (errorMessage.includes("Cost exceeds max collateral")) {
    // The calculated cost exceeds the maxCollateral parameter
  } else if (errorMessage.includes("Winning bin out of range")) {
    // When closing a market, the winning bin is outside the range
  } else if (errorMessage.includes("Not the winning bin")) {
    // When claiming a reward, binIndex is not the winning bin
  } else if (errorMessage.includes("No tokens to claim")) {
    // User has no tokens in the winning bin
  } else if (errorMessage.includes("Transfer failed")) {
    // ERC20 token transfer failed
  } else {
    // Other errors
    console.error("Unexpected error:", errorMessage);
  }
}
```

## Test Environment

To test integration with RangeBet without using real assets, you can use the Sepolia testnet.

### Getting Testnet Tokens

1. Request testnet ETH from a Sepolia faucet
2. Use the mock collateral tokens from our test deployment

### Example Testing Process

1. **Connect to Sepolia testnet**:

   - Network ID: 11155111
   - RPC URL: https://rpc.sepolia.org

2. **Test the basic flow**:

   - Connect wallet
   - Check available markets
   - Approve collateral token spending
   - Place a bet
   - Wait for market to close (or use an already closed market)
   - Claim rewards

3. **Testing the full integration**:
   - Implement all UI components
   - Connect to events
   - Handle all possible errors
   - Test with different user scenarios

### Testing Issues

If you encounter issues during testing, please check:

1. Proper network connection
2. Sufficient gas for transactions
3. Correct contract addresses
4. Proper signature of function calls

For help with integration issues, contact: support@rangebet.example
