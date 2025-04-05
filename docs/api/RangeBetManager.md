# RangeBetManager API Documentation

The `RangeBetManager` contract is the core contract of the RangeBet system, responsible for creating and managing all prediction markets.

## State Variables

### Public Variables

```solidity
RangeBetToken public rangeBetToken;
IERC20 public collateralToken;
uint256 public marketCount;
mapping(uint256 => Market) public markets;
```

- `rangeBetToken`: ERC1155 token contract instance
- `collateralToken`: ERC20 token contract instance used as collateral
- `marketCount`: Total number of markets created
- `markets`: Mapping from market ID to market data

### Market Struct

```solidity
struct Market {
    bool active;                    // Market active status
    bool closed;                    // Market closure status
    uint256 tickSpacing;            // Tick spacing
    int256 minTick;                 // Minimum tick
    int256 maxTick;                 // Maximum tick
    uint256 T;                      // Total token supply for the market
    uint256 collateralBalance;      // Total collateral balance
    int256 winningBin;              // Winning bin (set after market closure)
    uint256 openTimestamp;          // Timestamp when the market was created
    uint256 closeTimestamp;         // Scheduled market closure time (used only as metadata)
    mapping(int256 => uint256) q;   // Token quantity per bin
}
```

## Events

```solidity
event MarketCreated(uint256 indexed marketId, uint256 tickSpacing, int256 minTick, int256 maxTick, uint256 openTimestamp, uint256 closeTimestamp);
event TokensPurchased(uint256 indexed marketId, address indexed buyer, int256[] binIndices, uint256[] amounts, uint256 collateralAmount);
event MarketClosed(uint256 indexed marketId, int256 winningBin);
event RewardClaimed(uint256 indexed marketId, address indexed claimer, int256 binIndex, uint256 tokenAmount, uint256 rewardAmount);
event CollateralWithdrawn(address indexed to, uint256 amount);
```

## Constructor

```solidity
constructor(address _rangeBetToken, address _collateralToken) Ownable()
```

### Parameters

- `_rangeBetToken`: RangeBetToken contract address
- `_collateralToken`: Collateral token contract address

## Basic Functions

### createMarket

```solidity
function createMarket(
    uint256 tickSpacing,
    int256 minTick,
    int256 maxTick,
    uint256 _closeTime
) external onlyOwner returns (uint256 marketId)
```

Creates a new prediction market.

#### Parameters

- `tickSpacing`: Tick spacing
- `minTick`: Minimum tick value
- `maxTick`: Maximum tick value
- `_closeTime`: Scheduled market closure time (used only as metadata)

#### Return Value

- `marketId`: ID of the created market

#### Conditions

- The function caller must be the contract owner.
- `minTick` must be less than `maxTick`.
- `tickSpacing` must be positive.
- `minTick` and `maxTick` must be divisible by `tickSpacing`.

#### Events

- `MarketCreated`: Emitted when a market is created. The event includes `openTimestamp` and `closeTimestamp`.

### createBatchMarkets

```solidity
function createBatchMarkets(
    uint256[] calldata tickSpacings,
    int256[] calldata minTicks,
    int256[] calldata maxTicks,
    uint256[] calldata closeTimes
) external onlyOwner returns (uint256[] memory marketIds)
```

Creates multiple prediction markets in a single transaction.

#### Parameters

- `tickSpacings`: Array of tick spacings for each market
- `minTicks`: Array of minimum tick values for each market
- `maxTicks`: Array of maximum tick values for each market
- `closeTimes`: Array of scheduled close times for each market

#### Return Value

- `marketIds`: Array of IDs of the created markets

#### Conditions

- The function caller must be the contract owner.
- All input arrays must have the same length.
- At least one market must be created (array length > 0).
- For each market, the same validation rules as in `createMarket` apply:
  - `minTick` must be less than `maxTick`
  - `tickSpacing` must be positive
  - `minTick` and `maxTick` must be divisible by `tickSpacing`

#### Events

- `MarketCreated`: Emitted for each created market. The event includes `openTimestamp` and `closeTimestamp`.

### buyTokens

```solidity
function buyTokens(
    uint256 marketId,
    int256[] calldata binIndices,
    uint256[] calldata amounts,
    uint256 maxCollateral
) external nonReentrant
```

Purchases betting tokens for multiple bins in a specific market.

#### Parameters

- `marketId`: Market ID to bet on
- `binIndices`: Array of bin indices to bet on
- `amounts`: Array of token quantities to purchase for each bin
- `maxCollateral`: Maximum collateral token amount (slippage protection)

#### Conditions

- The market must exist and be active.
- The market must not be closed.
- The lengths of `binIndices` and `amounts` arrays must be the same.
- Each bin index must be within the min/max tick range of the market.
- Each bin index must be a multiple of `tickSpacing`.
- The user must have approved sufficient collateral tokens.
- The calculated total cost must not exceed `maxCollateral`.

#### Events

- `TokensPurchased`: Emitted when tokens are purchased.

### closeMarket

```solidity
function closeMarket(uint256 marketId, int256 winningBin) external onlyOwner
```

Closes a prediction market and sets the winning bin.

#### Parameters

- `marketId`: Market ID to close
- `winningBin`: Winning bin index

#### Conditions

- The function caller must be the contract owner.
- The market must exist and be active.
- The market must not be already closed.
- The winning bin must be within the min/max tick range of the market.
- The winning bin must be a multiple of `tickSpacing`.

#### Events

- `MarketClosed`: Emitted when a market is closed.

### claimReward

```solidity
function claimReward(uint256 marketId, int256 binIndex) external nonReentrant
```

Claims rewards from the winning bin of a closed market.

#### Parameters

- `marketId`: Market ID to claim rewards from
- `binIndex`: Bin index to claim rewards from

#### Conditions

- The market must exist and be closed.
- The bin to claim must be the winning bin.
- The user must hold tokens for that bin.

#### Prevention of Double Claims

This function completely burns the user's tokens, so once claimed, the balance becomes 0, naturally preventing double claims. A second claim attempt will fail with the `No tokens to claim` error.

#### Events

- `RewardClaimed`: Emitted when rewards are claimed.

### withdrawAllCollateral

```solidity
function withdrawAllCollateral(address to) external onlyOwner
```

Withdraws all collateral tokens from the contract.

#### Parameters

- `to`: Address to send the collateral to

#### Conditions

- The function caller must be the contract owner.
- There must be collateral tokens to withdraw.

#### Events

- `CollateralWithdrawn`: Emitted when collateral is withdrawn.

## View Functions

### getMarketInfo

```solidity
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
)
```

Returns information about a specific market.

#### Parameters

- `marketId`: Market ID

#### Return Values

- `active`: Market active status
- `closed`: Market closure status
- `tickSpacing`: Tick spacing
- `minTick`: Minimum tick value
- `maxTick`: Maximum tick value
- `T`: Total token supply for the market
- `collateralBalance`: Total collateral balance
- `winningBin`: Winning bin (set after market closure)
- `openTimestamp`: Timestamp when the market was created
- `closeTimestamp`: Scheduled market closure time (metadata)

### getBinQuantity

```solidity
function getBinQuantity(uint256 marketId, int256 binIndex) external view returns (uint256)
```

Returns the token quantity for a specific bin in a market.

#### Parameters

- `marketId`: Market ID
- `binIndex`: Bin index

#### Return Value

- Token quantity for the specified bin

### calculateBinCost

```solidity
function calculateBinCost(uint256 marketId, int256 binIndex, uint256 amount) external view returns (uint256)
```

Calculates the cost to buy tokens in a specific bin.

#### Parameters

- `marketId`: Market ID
- `binIndex`: Bin index
- `amount`: Token amount to purchase

#### Return Value

- Cost in collateral tokens for the specified amount

### calculateXForBin

```solidity
function calculateXForBin(uint256 marketId, int256 binIndex, uint256 cost) external view returns (uint256)
```

Calculates the amount of tokens that can be bought with the given cost for a specific bin.

#### Parameters

- `marketId`: Market ID
- `binIndex`: Bin index
- `cost`: The amount of collateral to spend

#### Return Value

- Amount of tokens that can be purchased with the specified cost

#### Special Cases

- Returns 0 if:
  - The market doesn't exist or is inactive
  - The market is closed
  - The bin index is outside the market's min/max tick range
  - The bin index is not a multiple of tick spacing

### validateBinIndex

```solidity
function validateBinIndex(uint256 marketId, int256 binIndex) public view
```

Validates if a bin index is valid. Reverts if not valid.

#### Parameters

- `marketId`: Market ID
- `binIndex`: Bin index to validate

### getBinQuantitiesInRange

```solidity
function getBinQuantitiesInRange(
    uint256 marketId,
    int256 fromBinIndex,
    int256 toBinIndex
) external view returns (int256[] memory binIndices, uint256[] memory quantities)
```

Retrieves token quantities for multiple bins in a market at once.

#### Parameters

- `marketId`: Market ID
- `fromBinIndex`: Starting bin index (inclusive)
- `toBinIndex`: Ending bin index (inclusive)

#### Return Values

- `binIndices`: Array of bin indices
- `quantities`: Array of token quantities for each bin

#### Conditions

- `fromBinIndex` must be less than or equal to `toBinIndex`.
- `fromBinIndex` and `toBinIndex` must be within the `minTick` and `maxTick` range.
- `fromBinIndex` and `toBinIndex` must be multiples of `tickSpacing`.

### Withdrawing Collateral

```solidity
// Get contract instance
RangeBetManager manager = RangeBetManager(managerAddress);

// Withdraw all collateral (owner only)
manager.withdrawAllCollateral(ownerAddress);
```

## Internal Functions

### \_calculateCost

```solidity
function _calculateCost(
    uint256 marketId,
    int256[] calldata binIndices,
    uint256[] calldata amounts
) internal view returns (uint256 totalCost)
```

Calculates the cost of betting across multiple bins.

#### Parameters

- `marketId`: Market ID
- `binIndices`: Array of bin indices to bet on
- `amounts`: Array of token quantities to purchase for each bin

#### Return Value

- `totalCost`: Total cost for all bins

### \_calculateBinCost

```solidity
function _calculateBinCost(
    uint256 amount,
    uint256 binQuantity,
    uint256 totalSupply
) internal pure returns (uint256)
```

Calculates the betting cost for a single bin.

#### Parameters

- `amount`: Token quantity to purchase
- `binQuantity`: Current token quantity in the bin
- `totalSupply`: Total token supply for the market

#### Return Value

- Calculated cost

## Error Codes

```solidity
error MarketNotActive();
error MarketAlreadyClosed();
error InvalidBinIndex();
error ArrayLengthMismatch();
error ZeroAmount();
error CollateralTransferFailed();
error NotWinningBin();
error NoTokens();
error CollateralTooHigh();
error MinTickGreaterThanMaxTick();
error TickSpacingZero();
error TickNotDivisibleBySpacing();
```

## Usage Examples

### Creating a Market

```solidity
// Get contract instance
RangeBetManager manager = RangeBetManager(managerAddress);

// Calculate closing time (e.g., 1 week later)
uint256 closeTime = block.timestamp + 7 days;

// Create market
uint256 marketId = manager.createMarket(60, -360, 360, closeTime);
```

### Betting

```solidity
// Get contract instances
RangeBetManager manager = RangeBetManager(managerAddress);
IERC20 collateral = IERC20(collateralAddress);

// Approve collateral tokens
collateral.approve(managerAddress, 100 ether);

// Execute bet
int256[] memory binIndices = new int256[](1);
uint256[] memory amounts = new uint256[](1);

binIndices[0] = 0; // Bet on bin 0
amounts[0] = 10 ether; // Purchase 10 tokens

manager.buyTokens(0, binIndices, amounts, 100 ether);
```

### Calculate Tokens for Given Cost

```solidity
// Get contract instance
RangeBetManager manager = RangeBetManager(managerAddress);

// Calculate how many tokens can be bought with 10 ether in bin 0
uint256 tokenAmount = manager.calculateXForBin(0, 0, 10 ether);

// Now use this tokenAmount in your application
```

### Closing a Market

```solidity
// Get contract instance
RangeBetManager manager = RangeBetManager(managerAddress);

// Close market (owner only)
manager.closeMarket(0, 0); // Close market 0, bin 0 wins
```

### Claiming Rewards

```solidity
// Get contract instance
RangeBetManager manager = RangeBetManager(managerAddress);

// Claim rewards
manager.claimReward(0, 0); // Claim rewards from bin 0 of market 0
```

### Querying Bin Quantities in Range

```solidity
// Get contract instance
RangeBetManager manager = RangeBetManager(managerAddress);

// Query bin information from -120 to 120 (5 bins total with spacing of 60)
(int256[] memory binIndices, uint256[] memory quantities) = manager.getBinQuantitiesInRange(0, -120, 120);

// binIndices: [-120, -60, 0, 60, 120]
// quantities: Token quantities for each bin
```
