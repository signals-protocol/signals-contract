# MockCollateralToken API Documentation

The `MockCollateralToken` contract is a simple ERC20 token used for testing purposes. It serves as the collateral token in the RangeBet system.

## State Variables

```solidity
uint8 private _decimals;
```

- `_decimals`: Number of decimal places for the token (default: 18)

## Events

```solidity
event TokensRequested(address indexed to, uint256 amount);
```

## Constructor

```solidity
constructor(string memory name, string memory symbol, uint256 initialSupply)
    ERC20(name, symbol)
    Ownable(msg.sender)
```

### Parameters

- `name`: Token name
- `symbol`: Token symbol
- `initialSupply`: Initial token supply (all allocated to the constructor caller)

## Functions

### mint

```solidity
function mint(address to, uint256 amount) external onlyOwner
```

Mints new tokens.

#### Parameters

- `to`: Address to receive the tokens
- `amount`: Amount of tokens to mint

#### Conditions

- The caller must be the contract owner.

### requestTokens

```solidity
function requestTokens(uint256 amount) external
```

Function allowing anyone to request tokens for testing purposes.

#### Parameters

- `amount`: Amount of tokens to request

#### Events

- `TokensRequested`: Emitted when tokens are requested.

### decimals

```solidity
function decimals() public view override returns (uint8)
```

Returns the number of decimal places for the token.

#### Return Value

- Number of decimal places (18)

## Usage Examples

### Token Deployment

```solidity
// Deploy contract
MockCollateralToken token = new MockCollateralToken("Test Token", "TST", 1000000 * 10**18);
```

### Token Minting

```solidity
// Get contract instance
MockCollateralToken token = MockCollateralToken(tokenAddress);

// Mint tokens (owner only)
token.mint(recipientAddress, 1000 * 10**18);
```

### Requesting Test Tokens

```solidity
// Get contract instance
MockCollateralToken token = MockCollateralToken(tokenAddress);

// Request tokens (anyone can do this)
token.requestTokens(5000 * 10**18);
```
