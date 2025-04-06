# RangeBet - Multi-Market Prediction System

RangeBet is a prediction market platform that implements the (q+t)/(T+t) integral pricing formula with a Uniswap V3-style tick-based interval (bin) system. It can operate multiple prediction markets simultaneously with a single contract and provides a unique pricing mechanism through a special betting cost calculation formula.

## Key Features

- Multiple prediction markets operated by a single manager contract
- Price range setting using Uniswap V3 tick structure (intervals/bins)
- Sophisticated betting cost calculation through the (q+t)/(T+t) integral formula
- Flexible token management based on ERC1155
- Ability to bet across various intervals
- Winning interval setting and reward distribution system

## Architecture

### Main Contracts

1. **RangeBetManager**:

   - Creation and management of prediction markets
   - Processing of bets (token purchases)
   - Market closure and winning bin setting
   - Reward claim processing

2. **RangeBetToken (ERC1155)**:

   - Token issuance for all markets and all bins
   - Token IDs encoded with marketId and binIndex

3. **RangeBetMath**:

   - Library that calculates the (q+t)/(T+t) integral formula
   - Fixed-point mathematical operations using the PRB Math library

4. **MockCollateralToken**:
   - Collateral token for testing

## Getting Started

### Requirements

- Node.js v16 or higher
- Yarn package manager
- Ethereum development environment

### Installation

```bash
# Clone repository
git clone https://github.com/your-username/signals-temp-contract.git
cd signals-temp-contract

# Install dependencies
yarn install
```

### Compilation

To compile the contracts:

```bash
yarn compile
```

### Testing

To run all tests:

```bash
yarn test
```

To run specific tests:

```bash
yarn test:market    # Run only market creation related tests
yarn test:token     # Run only token related tests
yarn test:math      # Run only math library tests
```

Run tests with gas usage report:

```bash
yarn test:gas
```

### Local Deployment

To deploy contracts to a local development node:

```bash
# Run local node in a new terminal
yarn node

# Run deployment in another terminal
yarn deploy:local
```

### Rootstock Testnet Deployment

To deploy to Rootstock testnet:

1. Create a `.env` file and set the required environment variables:

```
PRIVATE_KEY=your_private_key_here
ROOTSTOCK_TESTNET_URL=https://public-node.testnet.rsk.co
```

2. Run deployment:

```bash
yarn deploy:rsk
```

For detailed deployment information, refer to the [README-ROOTSTOCK-DEPLOY.md](./README-ROOTSTOCK-DEPLOY.md) file.

### Interaction Testing

To interact with already deployed contracts:

```bash
yarn interact:local  # Interact with contracts deployed on local node
yarn interact:rsk <rangeBetManagerAddress> <rangeBetTokenAddress> <collateralTokenAddress>  # Interact with contracts deployed on Rootstock
```

## System Operation

### Creating a Prediction Market

The administrator (contract owner) can create a new prediction market by calling `createMarket()`:

```javascript
await rangeBetManager.createMarket(
  60, // tickSpacing: Tick interval
  -360, // minTick: Minimum tick
  360, // maxTick: Maximum tick
  closeTime // Expected market closing time
);
```

### Token Purchase (Betting)

Users can bet on various intervals (bins) by calling `buyTokens()`:

```javascript
await rangeBetManager.buyTokens(
  marketId, // Market ID
  [0, 60], // Bin indices to bet on
  [ethers.parseEther("100"), ethers.parseEther("50")], // Amount to bet on each bin
  ethers.parseEther("200") // Maximum willing payment amount
);
```

### Market Closure and Setting the Winning Bin

The administrator closes the market and sets the winning bin by calling `closeMarket()`:

```javascript
await rangeBetManager.closeMarket(marketId, winningBin);
```

### Claiming Rewards

Token holders of the winning bin can claim rewards by calling `claimReward()`:

```javascript
await rangeBetManager.claimReward(marketId, winningBin);
```

## Mathematical Background

The betting cost is calculated based on the following integral:

![Integral Formula](https://latex.codecogs.com/png.latex?%5Cint_%7Bt%3D0%7D%5E%7Bx%7D%20%5Cfrac%7Bq%20%2B%20t%7D%7BT%20%2B%20t%7D%20%5C%2C%5Cmathrm%7Bd%7Dt%20%5C%3B%3D%5C%3B%20x%20%2B%20%28q%20-%20T%29%5C%2C%5Cln%5C%21%5CBigl%28%5Cfrac%7BT%20%2B%20x%7D%7BT%7D%5CBigr%29)

- `q`: Current amount of tokens in the bin
- `T`: Total supply of tokens in the entire market
- `x`: Amount of tokens to purchase

This formula means that the betting cost adjusts according to the market's liquidity. The more popular an interval is, the higher the cost to bet on it.

## Developer Documentation

For more detailed development documentation, refer to the [docs/](./docs/index.md) directory.

## License

Licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
