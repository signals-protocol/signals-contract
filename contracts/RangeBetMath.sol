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
    
    /**
     * @dev Calculates the amount of tokens (x) that can be bought with the given cost
     * using binary search. This is the reverse of the cost calculation formula.
     * @param cost The collateral cost user is willing to pay
     * @param q The current quantity of tokens in the bin
     * @param T The total supply of tokens in the market
     * @return x The amount of tokens (x) that can be bought with the given cost
     */
    function calculateX(uint256 cost, uint256 q, uint256 T) public pure returns (uint256) {
        if (cost == 0) return 0;
        if (T == 0) return cost; // Special case: first bet in the market
        
        // Define search range
        uint256 left = 0;
        uint256 right = (q > 0) ? (T * cost) / q : type(uint256).max;
        
        // Binary search with a maximum of 256 iterations
        uint256 maxIterations = 256;
        
        // Pre-calculate costs for boundary conditions to avoid shadowing
        uint256 leftCost;
        uint256 rightCost;
        
        for (uint256 i = 0; i < maxIterations; i++) {
            uint256 mid = (left + right) / 2;
            
            // Calculate cost for the mid value
            uint256 calculatedCost = calculateCost(mid, q, T);
            
            // If we found an exact match or we're at the precision limit
            if (calculatedCost == cost || right - left <= 1) {
                // If we're at precision limit, return the value that gives cost closest to target
                if (right - left <= 1) {
                    leftCost = calculateCost(left, q, T);
                    rightCost = calculateCost(right, q, T);
                    
                    if (leftCost == cost) return left;
                    if (rightCost == cost) return right;
                    
                    // Return the value that gives cost closest to target
                    if (cost > leftCost && cost > rightCost) {
                        return (rightCost > leftCost) ? right : left;
                    } else {
                        return (cost - leftCost < rightCost - cost) ? left : right;
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
        leftCost = calculateCost(left, q, T);
        rightCost = calculateCost(right, q, T);
        
        // Return the value that gives cost closest to target
        if (cost - leftCost < rightCost - cost) {
            return left;
        } else {
            return right;
        }
    }

    /**
     * @dev Calculates the revenue (in collateral) that the user would receive
     *      by selling `x` tokens in a bin currently holding `q` tokens,
     *      when total supply is `T`.
     *      Formula: ∫(q - t)/(T - t) dt = x + (q - T) * ln(T / (T - x))
     *
     * Requirements:
     * - x <= q (cannot sell more than bin's tokens)
     * - x <= T (cannot sell more than total supply)
     * - T > x (to avoid ln(T/0))
     */
    function calculateSellCost(uint256 x, uint256 q, uint256 T)
        public
        pure
        returns (uint256)
    {
        // 1) Edge cases
        if (x == 0) {
            return 0; // 판매량이 0인 경우는 에러가 아님, 수익도 0
        }
        
        // x > q 이거나 x > T인 상황이라면, 실제로는 불가능한 판매
        require(x <= q, "Cannot sell more tokens than available in bin");
        require(x <= T, "Cannot sell more tokens than total supply");
        
        // T == x 인 경우도 로그에서 분모가 0이 되어 수학적으로 불가
        require(x < T, "Cannot sell entire market supply (T=x)");

        // 2) 고정소수점 변환
        UD60x18 xUD = ud(x);
        UD60x18 qUD = ud(q);
        UD60x18 TUD = ud(T);

        // 3) ( T / (T - x) ) 계산
        UD60x18 ratio = TUD.div(TUD.sub(xUD));
        UD60x18 logTerm = ratio.ln();

        // 4) x + (q - T)*ln( T / (T - x) )
        UD60x18 revenue = xUD;
        
        if (q != T) {
            if (q > T) {
                // q > T 일 경우, (q - T) 항이 양수이므로 더하기
                UD60x18 qMinusT = qUD.sub(TUD);
                revenue = revenue.add(qMinusT.mul(logTerm));
            } else {
                // q < T 일 경우, (q - T) 항이 음수이므로 빼기
                UD60x18 TMinusq = TUD.sub(qUD);
                
                // 언더플로우 방지 - 로그 항이 너무 커서 x보다 크면 오류
                require(TMinusq.mul(logTerm) <= revenue, "Underflow in sell calculation");
                
                revenue = revenue.sub(TMinusq.mul(logTerm));
            }
        }

        return unwrap(revenue);
    }
} 