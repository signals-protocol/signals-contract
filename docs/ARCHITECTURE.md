# RangeBet Architecture Document

This document explains the core architecture and components of the RangeBet system.

## System Architecture Overview

RangeBet consists of the following main components:

```
                 ┌─────────────┐
                 │             │
                 │ RangeBetMath│◄────┐
                 │   Library   │     │
                 │             │     │
                 └─────────────┘     │
                                     │ Call
                                     │
┌─────────────┐      ┌──────────▼───────┐      ┌─────────────┐
│             │ Create│                  │Deploy/│             │
│  Market 1   │◄─────┤                  ├─────►│             │
│             │      │                  │Manage │             │
└─────────────┘      │ RangeBetManager  │      │RangeBetToken│
                     │                  │      │  (ERC1155)  │
┌─────────────┐ Manage│                  │      │             │
│             │◄─────┤                  │      │             │
│  Market 2   │      │                  │      │             │
│             │      └──────────▲───────┘      └─────────────┘
└─────────────┘                 │
                                │ Transfer
┌─────────────┐                 │
│             │       ┌─────────┴──────┐
│  Market N   │       │                │
│             │       │Collateral Token│
└─────────────┘       │    (ERC20)     │
                      │                │
                      └────────────────┘
```

### Contract Description

## 1. RangeBetManager

Central management contract that creates and manages all prediction markets.

### Main State Variables

```solidity
// Market struct
struct Market {
    bool active;             // Market active status
    bool closed;             // Market closed status
    uint256 tickSpacing;     // Tick spacing (e.g., 60)
    int256 minTick;          // Minimum tick (e.g., -360)
    int256 maxTick;          // Maximum tick (e.g., 360)
    uint256 T;               // Total token supply in the market
    uint256 collateralBalance; // Total collateral tokens
    int256 winningBin;       // Winning bin (set after market closes)
    uint256 openTimestamp;   // Timestamp when market was created
    uint256 closeTimestamp;  // Market scheduled close time (used only as metadata)
    mapping(int256 => uint256) q; // Token quantity for each bin
}

// Market mapping
mapping(uint256 => Market) public markets;

// Token contract references
RangeBetToken public rangeBetToken;
IERC20 public collateralToken;

// Market counter
uint256 public marketCount;
```

### Main Functions

#### 1. Market Creation

```solidity
function createMarket(
    uint256 tickSpacing,
    int256 minTick,
    int256 maxTick,
    uint256 _closeTime
) external onlyOwner returns (uint256 marketId)
```

- Creates a new prediction market with Uniswap V3 style tick spacing and range.
- `marketId` increases based on internal counter.
- `_closeTime` is the scheduled time when the market will close, used only as metadata.
- The contract automatically stores the timestamp when the market is created (`openTimestamp`).

#### 2. Token Purchase (Betting)

```solidity
function buyTokens(
    uint256 marketId,
    int256[] calldata binIndices,
    uint256[] calldata amounts,
    uint256 maxCollateral
) external nonReentrant
```

- Allows users to bet on multiple bins simultaneously.
- Uses the (q+t)/(T+t) integral formula to calculate costs.
- Issues ERC1155 tokens and transfers collateral tokens.

#### 3. Market Close

```solidity
function closeMarket(uint256 marketId, int256 winningBin) external onlyOwner
```

- Closes the market and sets the winning bin.
- New bets on that market are no longer possible afterward.

#### 4. Reward Claim

```solidity
function claimReward(uint256 marketId, int256 binIndex) external nonReentrant
```

- Token holders of the winning bin claim their rewards.
- Tokens are burned and users receive collateral tokens based on their holding ratio.

## 2. RangeBetToken (ERC1155)

An ERC1155 token contract that manages tokens for all markets and bins. Deployed and managed by RangeBetManager.

### Token ID Encoding

```solidity
function encodeTokenId(uint256 marketId, int256 binIndex) public pure returns (uint256)
```

- Encodes `marketId` and `binIndex` into a single `uint256` token ID.
- `tokenId = (marketId << 128) + (binIndex + OFFSET)`
- `OFFSET` is used to handle negative bin indices.

### Token ID Decoding

```solidity
function decodeTokenId(uint256 tokenId) public pure returns (uint256 marketId, int256 binIndex)
```

- Extracts the original `marketId` and `binIndex` from the token ID.

## 3. RangeBetMath

A library responsible for implementing the integral formula for calculating betting costs.

### Cost Calculation Function

```solidity
function calculateCost(uint256 x, uint256 q, uint256 T) public pure returns (uint256)
```

- Calculates the (q+t)/(T+t) integral formula: `x + (q-T)*ln((T+x)/T)`
- `x`: Amount of tokens to purchase
- `q`: Current token amount in the bin
- `T`: Total token supply in the market

## Module Interactions

1. **RangeBetManager ↔ RangeBetMath**:

   - Manager calls the Math library to calculate betting costs.

2. **RangeBetManager ↔ RangeBetToken**:

   - RangeBetManager deploys RangeBetToken in its constructor.
   - During betting, Manager mints tokens for the user.
   - During reward claiming, Manager burns tokens.

3. **RangeBetManager ↔ CollateralToken**:
   - During betting, collateral tokens are transferred from user to Manager.
   - During reward claiming, collateral tokens are transferred from Manager to user.

## Data Flow

1. **Market Creation**:

   ```
   Owner → RangeBetManager.createMarket(tickSpacing, minTick, maxTick, closeTime) → Market Storage (+ timestamp storage)
   ```

2. **Betting (Token Purchase)**:

   ```
   User → RangeBetManager.buyTokens() → RangeBetMath.calculateCost() → RangeBetToken.mint() → CollateralToken.transferFrom()
   ```

3. **Market Closing**:

   ```
   Owner → RangeBetManager.closeMarket() → Market Storage (closed=true, winningBin=X)
   ```

4. **Reward Claiming**:
   ```
   User → RangeBetManager.claimReward() → RangeBetToken.burn() → CollateralToken.transfer() → User
   ```

## Security Considerations

1. **Reentrancy Protection**:

   - `buyTokens()` and `claimReward()` functions are protected with the `nonReentrant` modifier.

2. **Access Control**:

   - Market creation and closing are restricted with `onlyOwner`.
   - Token minting and burning are restricted with `onlyManager`.

3. **Slippage Protection**:

   - The `maxCollateral` parameter allows users to specify their maximum willing payment amount.

4. **Double Claim Prevention**:
   - Token burning prevents users from claiming rewards twice.

## Gas Optimization

1. Process betting on multiple bins in a single transaction
2. Optimize bit operations for token ID encoding/decoding
3. Efficient implementation of fixed-point math operations

## Scalability Considerations

1. **Multiple Collateral Tokens**:

   - The system can be extended to support different collateral tokens per market.

2. **Oracle Integration**:

   - External oracles can be integrated to automatically determine the winning bin.

3. **Governance**:

   - Admin rights can be transferred to a DAO or multi-signature wallet.

4. **Frontend Support**:
   - The token metadata URI system can provide rich metadata for each market and bin.
