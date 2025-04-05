# RangeBet Documentation

RangeBet is a multi-market prediction platform that utilizes a Uniswap V3-style tick-based system. This documentation provides comprehensive information on all aspects of the RangeBet protocol.

## Table of Contents

### Overview

- [Architecture Overview](ARCHITECTURE.md) - Overview of system components and interactions
- [Mathematical Model](MATH.md) - Explanation of mathematical formulas and implementation for betting cost calculations

### Developer Guides

- [Integration Guide](INTEGRATION.md) - How to integrate with the RangeBet protocol
- [Contribution Guide](CONTRIBUTING.md) - How to contribute to the project and coding standards
- [Security Overview](SECURITY.md) - Security model, risks, and vulnerability reporting procedures

### API Reference

- [RangeBetManager API](api/RangeBetManager.md) - Market management contract API
- [RangeBetToken API](api/RangeBetToken.md) - Token contract API
- [RangeBetMath API](api/RangeBetMath.md) - Math library API

## Core Concepts

### Prediction Markets

The RangeBet system provides prediction markets where users can bet on specific outcome ranges. Each market consists of the following elements:

- **Ranges (Bins)**: Intervals representing possible outcome values
- **Tick Spacing**: Spacing between each bin
- **Betting Tokens**: Tokens for betting on specific bins (ERC1155)
- **Collateral Token**: ERC20 token used for betting

### Betting Mechanism

RangeBet's core betting mechanism has the following characteristics:

1. **Liquidity-Based Pricing**: The more bets on a specific bin, the higher the cost to bet on that bin
2. **Non-Linear Price Curve**: Price determination based on the (q+t)/(T+t) integral formula
3. **Winner Takes All**: When a market closes, only token holders of the winning bin receive rewards

## Getting Started

### Installation and Setup

```bash
# Clone repository
git clone https://github.com/yourusername/rangebet.git
cd rangebet

# Install dependencies
yarn install

# Compile contracts
yarn compile

# Run tests
yarn test
```

### Local Development Environment

```bash
# Run local Hardhat node
npx hardhat node

# Deploy contracts
npx hardhat run scripts/deploy.ts --network localhost

# Run interaction scripts
npx hardhat run scripts/interact.ts --network localhost
```

## Example Code

### Creating a Market

```typescript
// Get RangeBetManager contract instance
const manager = await ethers.getContractAt("RangeBetManager", managerAddress);

// Create a market with tick spacing 60, range from -360 to 360
// Market close time: 7 days from current time
const closeTime = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

const tx = await manager.createMarket(60, -360, 360, closeTime);
const receipt = await tx.wait();

// Extract market ID
const marketCreatedEvent = receipt.logs.find(
  (log) => log.fragment?.name === "MarketCreated"
);
const marketId = marketCreatedEvent.args[0];
console.log(`Market creation complete, ID: ${marketId}`);
```

### Betting (Buying Tokens)

```typescript
// Approve collateral token
const collateral = await ethers.getContractAt("IERC20", collateralAddress);
await collateral.approve(managerAddress, ethers.parseEther("100"));

// Bet on bin 0
const binIndices = [0];
const amounts = [ethers.parseEther("10")];
const maxCollateral = ethers.parseEther("100");

// Buy tokens
await manager.buyTokens(marketId, binIndices, amounts, maxCollateral);
```

### Closing Market and Claiming Rewards

```typescript
// Close market (winning bin: 0)
await manager.closeMarket(marketId, 0);

// Claim rewards
await manager.claimReward(marketId, 0);
```

## Console Tools

```bash
# Open Hardhat console
npx hardhat console --network localhost

# Get contract instances
const manager = await ethers.getContractAt("RangeBetManager", "0x...");
const token = await ethers.getContractAt("RangeBetToken", "0x...");

# Query market information
const marketInfo = await manager.getMarketInfo(0);
console.log(marketInfo);
```

## Support and Contact

- **GitHub Issues**: Bug reports and feature requests
- **Email**: support@example.com
- **Discord**: [RangeBet Discord Channel](https://discord.gg/example)

## License

RangeBet is provided under the MIT license. See the [LICENSE](../LICENSE) file for details.
