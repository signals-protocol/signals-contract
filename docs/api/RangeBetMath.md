# RangeBetMath API Documentation

The `RangeBetMath` library is a mathematical library responsible for calculating token purchase costs in the RangeBet system. This library implements fixed-point mathematical operations using the PRBMath library.

## Overview

RangeBetMath implements a cost calculation formula based on the (q+t)/(T+t) integral. This formula calculates the amount of collateral tokens a user must pay, considering the current market state and the quantity of tokens they want to purchase.

## Dependencies

```solidity
import { UD60x18, ud, unwrap } from "@prb/math/src/UD60x18.sol";
```

- PRBMath: Library for fixed-point mathematical operations

## Mathematical Foundation

### Basic Formula

When a user wants to purchase `x` amount of tokens for a specific bin, the cost is calculated with the following integral:

![Cost = \int_{0}^{x} \frac{q + t}{T + t} dt](https://latex.codecogs.com/png.latex?Cost%20%3D%20%5Cint_%7B0%7D%5E%7Bx%7D%20%5Cfrac%7Bq%20%2B%20t%7D%7BT%20%2B%20t%7D%20dt)

### Final Formula

Solving the integral yields the following formula:

![Cost = x + (q - T) \ln\frac{T + x}{T}](https://latex.codecogs.com/png.latex?Cost%20%3D%20x%20%2B%20%28q%20-%20T%29%20%5Cln%5Cfrac%7BT%20%2B%20x%7D%7BT%7D)

Where:

- `x`: Token quantity to purchase
- `q`: Current token quantity in the bin
- `T`: Total token supply for the market
- `ln`: Natural logarithm function

## Functions

### calculateCost

```solidity
function calculateCost(
    uint256 x,
    uint256 q,
    uint256 T
) public pure returns (uint256)
```

Calculates the token purchase cost based on the specified parameters.

#### Parameters

- `x`: Token quantity to purchase
- `q`: Current token quantity in the bin
- `T`: Total token supply for the market

#### Return Value

- Calculated collateral token cost

#### Special Cases

- If `q == T`, the cost is exactly `x`.
- If `q > T`, the cost is greater than `x` (premium).
- If `q < T`, the cost is less than `x` (discount).

#### Implementation Details

```solidity
function calculateCost(uint256 x, uint256 q, uint256 T) public pure returns (uint256) {
    if (x == 0) return 0;
    if (T == 0) return x; // Special case: first bet in the market

    // Convert to UD60x18
    UD60x18 xUD = ud(x);
    UD60x18 qUD = ud(q);
    UD60x18 TUD = ud(T);

    // First term: x
    UD60x18 cost = xUD;

    // Second term: (q-T)*ln((T+x)/T)
    if (q != T) { // If q == T, this part becomes 0
        // Calculate (T+x)/T
        UD60x18 ratio = (TUD + xUD) / TUD;
        // Calculate ln((T+x)/T)
        UD60x18 logTerm = ratio.ln();

        // Calculate (q-T)
        if (q > T) {
            // If q > T, add (q-T)*ln((T+x)/T)
            UD60x18 qMinusT = qUD - TUD;
            cost = cost + (qMinusT * logTerm);
        } else {
            // If q < T, subtract (T-q)*ln((T+x)/T)
            UD60x18 TMinusq = TUD - qUD;
            // Prevent underflow
            if ((TMinusq * logTerm) > cost) {
                return 0;
            }
            cost = cost - (TMinusq * logTerm);
        }
    }

    // Convert to uint256
    return unwrap(cost);
}
```

### calculateX

```solidity
function calculateX(
    uint256 cost,
    uint256 q,
    uint256 T
) public pure returns (uint256)
```

Calculates the amount of tokens (x) that can be purchased with a given cost, using binary search. This is the inverse of the `calculateCost` function.

#### Parameters

- `cost`: Collateral token amount a user wants to spend
- `q`: Current token quantity in the bin
- `T`: Total token supply for the market

#### Return Value

- The maximum token quantity that can be purchased with the given cost

#### Special Cases

- If `cost == 0`, returns 0.
- If `T == 0` (first bet in the market), returns cost directly.

#### Implementation Details

```solidity
function calculateX(uint256 cost, uint256 q, uint256 T) public pure returns (uint256) {
    if (cost == 0) return 0;
    if (T == 0) return cost; // Special case: first bet in the market

    // Define search range
    uint256 left = 0;
    uint256 right = cost * 2; // Start with a reasonable upper bound

    // If q > 0, we can set a better upper bound based on the formula
    if (q > 0) {
        // For q > 0, an approximation is (T * cost) / q
        uint256 approxUpperBound = (T * cost) / q;
        if (approxUpperBound > 0) {
            right = approxUpperBound;
        }
    }

    // Binary search with a maximum of 100 iterations
    uint256 maxIterations = 100;
    for (uint256 i = 0; i < maxIterations; i++) {
        uint256 mid = (left + right) / 2;

        // Calculate cost for the mid value
        uint256 calculatedCost = calculateCost(mid, q, T);

        // If we found an exact match or we're at the precision limit
        if (calculatedCost == cost || right - left <= 1) {
            // Handle precision limit case
            if (right - left <= 1) {
                uint256 leftCost = calculateCost(left, q, T);
                uint256 rightCost = calculateCost(right, q, T);

                // Return the value that gives cost closest to target
                if (cost - leftCost < rightCost - cost) {
                    return left;
                } else {
                    return right;
                }
            }
            return mid;
        }

        // Adjust search range
        if (calculatedCost < cost) {
            left = mid;
        } else {
            right = mid;
        }
    }

    // After max iterations, return the best approximation
    uint256 leftCost = calculateCost(left, q, T);
    uint256 rightCost = calculateCost(right, q, T);

    // Return the value that gives cost closest to target
    if (cost - leftCost < rightCost - cost) {
        return left;
    } else {
        return right;
    }
}
```

### calculateSellCost

```solidity
function calculateSellCost(uint256 x, uint256 q, uint256 T) public pure returns (uint256)
```

Calculates the revenue (in collateral) that would be received from selling tokens.

#### Parameters

- `x`: Amount of tokens to sell
- `q`: Current token quantity in the bin
- `T`: Total token supply for the market

#### Return Value

- Revenue in collateral tokens for selling the specified amount

#### Conditions

- `x` must not exceed the bin's token quantity (`x <= q`).
- `x` must not exceed the total token supply (`x <= T`).
- `x` must be less than the total token supply (`x < T`) to avoid division by zero in the logarithm calculation.

#### Implementation Details

This function calculates the revenue based on the inverse of the buying formula, using the integral:
∫(q - t)/(T - t) dt = x + (q - T) \* ln(T / (T - x))

## Usage Examples

### Usage in RangeBetManager

```solidity
// Inside RangeBetManager contract
import "./RangeBetMath.sol";

contract RangeBetManager {
    // Set up RangeBetMath library usage

    // ...

    function _calculateBinCost(
        uint256 amount,
        uint256 binQuantity,
        uint256 totalSupply
    ) internal view returns (uint256) {
        // Calculate cost using RangeBetMath library
        return RangeBetMath.calculateCost(amount, binQuantity, totalSupply);
    }

    function _calculateTokensForCost(
        uint256 cost,
        uint256 binQuantity,
        uint256 totalSupply
    ) internal view returns (uint256) {
        // Calculate tokens that can be bought with the given cost
        return RangeBetMath.calculateX(cost, binQuantity, totalSupply);
    }

    // ...
}
```

### Independent Usage

```solidity
// In a separate contract or script
import "./RangeBetMath.sol";

contract ExampleContract {
    // Example of using RangeBetMath
    function calculateExampleCost() public pure returns (uint256) {
        uint256 tokensToBuy = 100 * 10**18;  // 100 tokens
        uint256 currentBinQuantity = 500 * 10**18;  // 500 tokens currently in the bin
        uint256 marketTotalSupply = 1000 * 10**18;  // 1000 tokens total in the market

        // Calculate cost
        return RangeBetMath.calculateCost(
            tokensToBuy,
            currentBinQuantity,
            marketTotalSupply
        );
    }

    // Example of calculating tokens for a given cost
    function calculateExampleTokens() public pure returns (uint256) {
        uint256 costToSpend = 95.3 * 10**18;  // 95.3 tokens worth of cost
        uint256 currentBinQuantity = 500 * 10**18;  // 500 tokens currently in the bin
        uint256 marketTotalSupply = 1000 * 10**18;  // 1000 tokens total in the market

        // Calculate tokens that can be bought
        return RangeBetMath.calculateX(
            costToSpend,
            currentBinQuantity,
            marketTotalSupply
        );
        // Should return approximately 100 tokens
    }
}
```

## Performance Considerations

### Gas Optimization

The RangeBetMath library includes complex mathematical operations, so the gas cost can be substantial. The following optimizations have been applied:

1. Early handling of special cases (`q = T`, `x = 0`, `T = 0`)
2. Storing and reusing partial calculation results
3. Using PRBMath's optimized fixed-point operations

### Recommended Usage

- To save gas costs for on-chain calculations, it's recommended to pre-calculate costs off-chain when possible and use on-chain calculations only for verification.
- When dealing with large numbers, perform sufficient testing to prevent overflow.

## Limitations

- Due to precision limitations in the PRBMath library, approximate values may be returned for extreme values.
- Very large token quantities (> 1e27) may cause overflow, so it's recommended to use within a reasonable range.
- The `calculateX` function uses binary search with a limited number of iterations, so results may have small approximation errors.

## Sample Calculations

| Purchase Amount (x) | Bin Quantity (q) | Market Total (T) | Calculated Cost | Ratio (Cost/x) |
| ------------------- | ---------------- | ---------------- | --------------- | -------------- |
| 10                  | 0                | 100              | 9.05            | 0.905          |
| 10                  | 50               | 100              | 9.53            | 0.953          |
| 10                  | 100              | 100              | 10.00           | 1.000          |
| 10                  | 200              | 100              | 10.95           | 1.095          |
| 100                 | 0                | 1000             | 90.5            | 0.905          |
| 100                 | 500              | 1000             | 95.3            | 0.953          |
| 100                 | 1000             | 1000             | 100.0           | 1.000          |
| 100                 | 2000             | 1000             | 109.3           | 1.093          |
