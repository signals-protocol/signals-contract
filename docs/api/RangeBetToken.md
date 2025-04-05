# RangeBetToken API Documentation

The `RangeBetToken` contract is an ERC1155-based contract responsible for token management in the RangeBet system. This contract tracks tokens for all markets and bins.

## Constants

```solidity
uint256 private constant OFFSET = 1e9;
```

- `OFFSET`: Offset value used to handle negative bin indices

## State Variables

```solidity
address public manager;
```

- `manager`: RangeBetManager contract address (has token minting and burning authority)

## Events

```solidity
event TokenMinted(address indexed to, uint256 indexed tokenId, uint256 amount);
event TokenBurned(address indexed from, uint256 indexed tokenId, uint256 amount);
```

## Modifiers

```solidity
modifier onlyManager()
```

Checks if the function caller is the same as the set `manager` address.

## Constructor

```solidity
constructor(string memory uri_, address manager_) ERC1155(uri_)
```

Initializes the ERC1155 token with the specified URI and sets the manager address.

#### Parameters

- `uri_`: Base URI for token metadata
- `manager_`: Manager contract address

## Token Management Functions

### mint

```solidity
function mint(address to, uint256 id, uint256 amount) external onlyManager
```

Mints tokens for a specific token ID.

#### Parameters

- `to`: Address to receive the tokens
- `id`: Token ID (encoded market ID and bin index)
- `amount`: Token quantity to mint

#### Conditions

- The function caller must be the `manager`.

#### Events

- `TokenMinted`: Emitted when tokens are minted.

### mintBatch

```solidity
function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts) external onlyManager
```

Mints tokens for multiple token IDs at once.

#### Parameters

- `to`: Address to receive the tokens
- `ids`: Array of token IDs
- `amounts`: Array of quantities to mint for each token ID

#### Conditions

- The function caller must be the `manager`.

#### Events

- No explicit `TokenMinted` events are emitted in this function
- ERC1155 standard automatically emits a `TransferBatch` event

### burn

```solidity
function burn(address from, uint256 id, uint256 amount) external onlyManager
```

Burns tokens of a specific token ID from a specific address.

#### Parameters

- `from`: Address to burn tokens from
- `id`: Token ID
- `amount`: Token quantity to burn

#### Conditions

- The function caller must be the `manager`.

#### Events

- `TokenBurned`: Emitted when tokens are burned.

## Token ID Encoding/Decoding Functions

### encodeTokenId

```solidity
function encodeTokenId(uint256 marketId, int256 binIndex) public pure returns (uint256)
```

Encodes a market ID and bin index into a single token ID.

#### Parameters

- `marketId`: Market ID
- `binIndex`: Bin index

#### Return Value

- Encoded token ID

#### Encoding Method

The token ID is calculated as follows:

```
tokenId = (marketId << 128) + (binIndex + OFFSET)
```

Where `OFFSET` is used to handle negative bin indices.

### decodeTokenId

```solidity
function decodeTokenId(uint256 tokenId) public pure returns (uint256 marketId, int256 binIndex)
```

Decodes a token ID into a market ID and bin index.

#### Parameters

- `tokenId`: Token ID to decode

#### Return Values

- `marketId`: Market ID
- `binIndex`: Bin index

#### Decoding Method

The market ID and bin index are extracted as follows:

```
marketId = tokenId >> 128;
binIndex = int256(tokenId & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) - int256(OFFSET);
```

## Management Functions

### setManager

```solidity
function setManager(address newManager) external onlyManager
```

Updates the manager address to a new address. Only the current manager can call this function.

#### Parameters

- `newManager`: New manager address

#### Conditions

- The function caller must be the current `manager`.
- The new manager address must not be the zero address.

## Usage Examples

### Token ID Encoding/Decoding

```solidity
// Get contract instance
RangeBetToken token = RangeBetToken(tokenAddress);

// Encode token ID
uint256 tokenId = token.encodeTokenId(1, 60);

// Decode token ID
(uint256 marketId, int256 binIndex) = token.decodeTokenId(tokenId);
// marketId == 1, binIndex == 60
```

### Querying Token Balance

```solidity
// Get contract instance
RangeBetToken token = RangeBetToken(tokenAddress);

// Query token balance for a specific market and bin
uint256 marketId = 1;
int256 binIndex = 60;
uint256 tokenId = token.encodeTokenId(marketId, binIndex);
uint256 balance = token.balanceOf(userAddress, tokenId);
```

### Minting Tokens (Only callable from RangeBetManager)

```solidity
// Example implementation inside RangeBetManager
function buyTokens(...) external {
    // ... cost calculation, etc.

    // Mint tokens
    uint256[] memory tokenIds = new uint256[](binIndices.length);
    uint256[] memory mintedAmounts = new uint256[](binIndices.length);

    for (uint256 i = 0; i < binIndices.length; i++) {
        tokenIds[i] = rangeBetToken.encodeTokenId(marketId, binIndices[i]);
        mintedAmounts[i] = amounts[i];
    }

    // Execute batch minting
    rangeBetToken.mintBatch(msg.sender, tokenIds, mintedAmounts);

    // ...
}
```

### Burning Tokens (Only callable from RangeBetManager)

```solidity
// Example implementation inside RangeBetManager
function claimReward(uint256 marketId, int256 binIndex) external {
    // ... reward calculation, etc.

    // Calculate token ID
    uint256 tokenId = rangeBetToken.encodeTokenId(marketId, binIndex);

    // Query user's token balance
    uint256 userBalance = rangeBetToken.balanceOf(msg.sender, tokenId);

    // Burn tokens
    rangeBetToken.burn(msg.sender, tokenId, userBalance);

    // ... transfer rewards
}
```
