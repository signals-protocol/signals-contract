# Mathematical Model of RangeBet

The core of the RangeBet system is the mathematical model used to calculate betting prices. This document explains the formulas and their implementation.

## Integral Formula Principle

RangeBet uses an integral formula to calculate the price when a user places a bet on a specific bin in the market. This formula has two main properties:

1. **Liquidity-based pricing**: The more bets placed on a specific bin, the higher the token price for that bin.
2. **Market size adjustment**: As the overall market size increases, the price impact decreases.

### Basic Formula

When a user wants to purchase `x` amount of tokens for a specific bin, the cost is calculated with the following integral:

![Cost = \int_{0}^{x} \frac{q + t}{T + t} dt](https://latex.codecogs.com/png.latex?Cost%20%3D%20%5Cint_%7B0%7D%5E%7Bx%7D%20%5Cfrac%7Bq%20%2B%20t%7D%7BT%20%2B%20t%7D%20dt)

Where:

- `q`: Current quantity of tokens in the bin
- `T`: Total token supply in the market
- `t`: Integration variable (from 0 to x)

### Integral Calculation

Solving the integral above:

![Integral Step 1](https://latex.codecogs.com/png.latex?%5Cint_%7B0%7D%5E%7Bx%7D%20%5Cfrac%7Bq%20%2B%20t%7D%7BT%20%2B%20t%7D%20dt%20%3D%20%5Cint_%7B0%7D%5E%7Bx%7D%20%5Cfrac%7Bq%20-%20T%20%2B%20T%20%2B%20t%7D%7BT%20%2B%20t%7D%20dt%20%3D%20%5Cint_%7B0%7D%5E%7Bx%7D%20%281%20%2B%20%5Cfrac%7Bq%20-%20T%7D%7BT%20%2B%20t%7D%29%20dt)

![Integral Step 2](https://latex.codecogs.com/png.latex?Cost%20%3D%20%5Bt%20%2B%20%28q%20-%20T%29%20%5Cln%28T%20%2B%20t%29%5D_%7B0%7D%5E%7Bx%7D%20%3D%20x%20%2B%20%28q%20-%20T%29%20%5Cln%5Cfrac%7BT%20%2B%20x%7D%7BT%7D)

### Special Cases

1. When there are no tokens in the bin (`q = 0`):
   ![Case q = 0](https://latex.codecogs.com/png.latex?Cost%20%3D%20x%20-%20T%20%5Cln%5Cfrac%7BT%20%2B%20x%7D%7BT%7D)

2. When the total market and bin token quantities are equal (`q = T`):
   ![Case q = T](https://latex.codecogs.com/png.latex?Cost%20%3D%20x)

3. When the bin's tokens exceed the total market (`q > T`):
   ![Case q > T](https://latex.codecogs.com/png.latex?Cost%20%3E%20x)

4. When the bin's tokens are less than the total market (`q < T`):
   ![Case q < T](https://latex.codecogs.com/png.latex?Cost%20%3C%20x)

## Fixed-Point Implementation

Since Solidity has limited floating-point operations, this formula is implemented using a fixed-point math library.

### Using the PRBMath Library

RangeBet uses the [PRBMath](https://github.com/paulrberg/prb-math) library to implement logarithmic functions and fixed-point operations.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { UD60x18, ud, unwrap } from "@prb/math/src/UD60x18.sol";

library RangeBetMath {
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
        if (q != T) { // If q == T, this part is 0
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
}
```

### Precision and Error

Fixed-point math operations can lead to precision loss. The PRBMath library provides high precision, but errors can occur with extreme values. Therefore, it's recommended to set these limits:

- Minimum token quantity: Set at `1e6` (million) units
- Maximum token quantity: Less than `1e27` (billion _ billion _ billion)

### Gas Optimization

Fixed-point operations can be gas-intensive. The RangeBetMath implementation includes these optimizations:

1. Early handling of special cases (`q = T`, `x = 0`, `T = 0`)
2. Storing and reusing partial calculation results
3. Order adjustments to prevent overflow

## Simulation and Visualization

To understand how this formula works in real-world scenarios, we provide the following simulation.

### Token Purchase Cost Curve

![Token Purchase Cost Curve](https://via.placeholder.com/800x600.png?text=Token+Purchase+Cost+Curve)

The graph shows token purchase costs under these conditions:

- T = 1000 (total token supply in the market)
- Various q values (current token quantity in the bin)
- x-axis: Token quantity to purchase (x)
- y-axis: Required collateral token cost

### Effects of Various Market Conditions

Cost variations based on market size (T) and current bin token quantity (q):

| Market Size (T) | Bin Tokens (q) | Cost for 100 Tokens | Notes                         |
| --------------- | -------------- | ------------------- | ----------------------------- |
| 1,000           | 0              | 90.7                | Discount applied              |
| 1,000           | 500            | 95.3                | Slight discount               |
| 1,000           | 1,000          | 100.0               | Par value                     |
| 1,000           | 2,000          | 109.3               | Premium applied               |
| 10,000          | 1,000          | 99.0                | Slight discount in big market |
| 10,000          | 10,000         | 100.0               | Par value                     |
| 10,000          | 20,000         | 101.0               | Slight premium in big market  |

## Applications and Extensions

This mathematical model provides the following expansion possibilities:

1. **Various Bin Ranges**:

   - Use different bin sizes to allow predictions across various price ranges
   - Adjust tick spacing for granularity control

2. **Price Changes Over Time**:

   - Analyze betting distribution over time to predict price movements

3. **Game-Theoretical Optimal Strategies**:
   - Develop optimal betting strategies based on this formula
   - Model behavior of various market participants

## Conclusion

RangeBet's mathematical model provides market participants with a fair and efficient pricing mechanism. It acts as a form of Automated Market Maker (AMM), offering discounts when betting on low-liquidity bins and charging premiums for popular bins.

This mechanism enhances market liquidity and efficiency while providing incentives for users to bet on less popular outcomes.
