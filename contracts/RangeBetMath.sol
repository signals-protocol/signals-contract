// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { UD60x18, ud, unwrap } from "@prb/math/src/UD60x18.sol";

/**
 * @title RangeBetMath
 * @dev Library for mathematical calculations related to the Range Bet prediction market.
 * Implements the (q+t)/(T+t) integral formula for calculating bet costs.
 */
library RangeBetMath {
    /**
     * @dev Calculates the cost of buying tokens based on the integral formula
     * Formula: ∫(q+t)/(T+t) dt = x + (q-T)*ln((T+x)/T)
     * @param x Amount of tokens to buy
     * @param q Current quantity of tokens in the bin
     * @param T Total supply of tokens in the market
     * @return cost Cost in collateral tokens
     */
    function calculateCost(uint256 x, uint256 q, uint256 T) public pure returns (uint256) {
        if (x == 0) return 0;
        if (T == 0) return x; // Special case: first bet in the market

        // Convert to UD60x18
        UD60x18 xUD = ud(x);
        UD60x18 qUD = ud(q);
        UD60x18 TUD = ud(T);
        
        // First part: x
        UD60x18 cost = xUD;
        
        // Second part: (q-T)*ln((T+x)/T)
        if (q != T) { // Skip this part if q == T as it would be 0
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
                // Make sure we don't underflow
                if ((TMinusq * logTerm) > cost) {
                    return 0;
                }
                cost = cost - (TMinusq * logTerm);
            }
        }
        
        // Convert back to uint256
        return unwrap(cost);
    }
} 