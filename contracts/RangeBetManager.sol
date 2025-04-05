// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./RangeBetToken.sol";
import "./RangeBetMath.sol";

/**
 * @title RangeBetManager
 * @dev Main contract for managing prediction markets with (q+t)/(T+t) integral formula
 * and Uniswap V3-style tick ranges.
 */
contract RangeBetManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Struct to hold market data
    struct Market {
        bool active;             // Whether the market is active
        bool closed;             // Whether the market is closed
        uint256 tickSpacing;     // Spacing between consecutive bins, e.g., 60
        int256 minTick;          // Minimum tick (inclusive), e.g., -360
        int256 maxTick;          // Maximum tick (inclusive), e.g., 360
        uint256 T;               // Total supply of tokens in the market
        uint256 collateralBalance; // Total collateral balance in the market
        int256 winningBin;       // The winning bin (set when market is closed)
        uint256 openTimestamp;   // Market creation (open) timestamp
        uint256 closeTimestamp;  // Time when the market is scheduled to close (metadata)
        mapping(int256 => uint256) q; // Quantity of tokens in each bin
    }

    // State variables
    RangeBetToken public rangeBetToken;
    IERC20 public collateralToken;
    uint256 public marketCount;
    mapping(uint256 => Market) public markets;

    // Events
    event MarketCreated(uint256 indexed marketId, uint256 tickSpacing, int256 minTick, int256 maxTick, uint256 openTimestamp, uint256 closeTimestamp);
    event TokensBought(uint256 indexed marketId, address indexed buyer, int256[] binIndices, uint256[] amounts, uint256 totalCost);
    event MarketClosed(uint256 indexed marketId, int256 winningBin);
    event RewardClaimed(uint256 indexed marketId, address indexed claimer, int256 binIndex, uint256 amount);
    event CollateralWithdrawn(address indexed to, uint256 amount);

    /**
     * @dev Constructor - initializes contracts and owner
     * @param _collateralToken The ERC20 token used as collateral (e.g., USDC)
     * @param tokenURI The base URI for token metadata
     */
    constructor(address _collateralToken, string memory tokenURI) Ownable(msg.sender) {
        collateralToken = IERC20(_collateralToken);
        // Deploy the token contract
        rangeBetToken = new RangeBetToken(tokenURI, address(this));
    }

    /**
     * @dev Creates a new prediction market
     * @param tickSpacing The spacing between consecutive bins
     * @param minTick The minimum tick value (inclusive)
     * @param maxTick The maximum tick value (inclusive)
     * @param _closeTime The scheduled time when the market will close (metadata)
     * @return marketId The ID of the newly created market
     */
    function createMarket(
        uint256 tickSpacing,
        int256 minTick,
        int256 maxTick,
        uint256 _closeTime
    ) external onlyOwner returns (uint256 marketId) {
        require(tickSpacing > 0, "Tick spacing must be positive");
        require(minTick % int256(tickSpacing) == 0, "Min tick must be a multiple of tick spacing");
        require(maxTick % int256(tickSpacing) == 0, "Max tick must be a multiple of tick spacing");
        require(minTick < maxTick, "Min tick must be less than max tick");
        
        // Assign a new market ID
        marketId = marketCount;
        marketCount++;
        
        // Create a new market
        Market storage market = markets[marketId];
        market.active = true;
        market.closed = false;
        market.tickSpacing = tickSpacing;
        market.minTick = minTick;
        market.maxTick = maxTick;
        market.T = 0;
        market.collateralBalance = 0;
        market.winningBin = 0;
        market.openTimestamp = block.timestamp;  
        market.closeTimestamp = _closeTime;       
        
        emit MarketCreated(marketId, tickSpacing, minTick, maxTick, market.openTimestamp, market.closeTimestamp);
    }

    /**
     * @dev Buys tokens in multiple bins for a specific market
     * @param marketId The ID of the market
     * @param binIndices Array of bin indices where tokens will be bought
     * @param amounts Array of token amounts to buy for each bin
     * @param maxCollateral Maximum amount of collateral the user is willing to spend
     */
    function buyTokens(
        uint256 marketId,
        int256[] calldata binIndices,
        uint256[] calldata amounts,
        uint256 maxCollateral
    ) external nonReentrant {
        Market storage market = markets[marketId];
        require(market.active, "Market is not active");
        require(!market.closed, "Market is closed");
        require(binIndices.length == amounts.length, "Array lengths must match");
        require(binIndices.length > 0, "Must buy at least one bin");
        
        uint256 totalCost = 0;
        uint256 Tcurrent = market.T;
        
        // 1) Prepare: create tokenIds and mintedAmounts arrays
        uint256 len = binIndices.length;
        uint256[] memory tokenIds = new uint256[](len);
        uint256[] memory mintedAmounts = new uint256[](len);
        
        // 2) Process each bin
        for (uint256 i = 0; i < len; i++) {
            int256 binIndex = binIndices[i];
            uint256 amount = amounts[i];
            
            // Skip if amount is 0
            if (amount == 0) continue;
            
            require(binIndex % int256(market.tickSpacing) == 0, "Bin index must be a multiple of tick spacing");
            require(binIndex >= market.minTick && binIndex <= market.maxTick, "Bin index out of range");
            
            // Calculate cost for this bin
            uint256 qBin = market.q[binIndex];
            uint256 cost = RangeBetMath.calculateCost(amount, qBin, Tcurrent);
            
            // Update state
            market.q[binIndex] = qBin + amount;
            Tcurrent += amount;
            totalCost += cost;
            
            // Save tokenId and mintedAmount
            tokenIds[i] = rangeBetToken.encodeTokenId(marketId, binIndex);
            mintedAmounts[i] = amount;
        }
        
        // Check if the cost is within the user's limit
        require(totalCost <= maxCollateral, "Cost exceeds max collateral");
        
        // Update market state
        market.T = Tcurrent;
        market.collateralBalance += totalCost;
        
        // Transfer collateral from user to contract
        collateralToken.safeTransferFrom(msg.sender, address(this), totalCost);
        
        // Execute batch minting
        rangeBetToken.mintBatch(msg.sender, tokenIds, mintedAmounts);
        
        emit TokensBought(marketId, msg.sender, binIndices, amounts, totalCost);
    }

    /**
     * @dev Closes a market and sets the winning bin
     * @param marketId The ID of the market to close
     * @param winningBin The bin that won (where the actual value landed)
     */
    function closeMarket(uint256 marketId, int256 winningBin) external onlyOwner {
        Market storage market = markets[marketId];
        require(market.active, "Market is not active");
        require(!market.closed, "Market is already closed");
        require(winningBin % int256(market.tickSpacing) == 0, "Winning bin must be a multiple of tick spacing");
        require(winningBin >= market.minTick && winningBin <= market.maxTick, "Winning bin out of range");
        
        market.closed = true;
        market.winningBin = winningBin;
        
        emit MarketClosed(marketId, winningBin);
    }

    /**
     * @dev Claims reward for a winning position
     * @param marketId The ID of the market
     * @param binIndex The bin index for which to claim rewards
     */
    function claimReward(uint256 marketId, int256 binIndex) external nonReentrant {
        Market storage market = markets[marketId];
        require(market.closed, "Market is not closed");
        require(binIndex == market.winningBin, "Not the winning bin");
        
        uint256 tokenId = rangeBetToken.encodeTokenId(marketId, binIndex);
        uint256 userBalance = rangeBetToken.balanceOf(msg.sender, tokenId);
        require(userBalance > 0, "No tokens to claim");
        
        uint256 totalWinningTokens = market.q[binIndex];
        uint256 reward = (userBalance * market.collateralBalance) / totalWinningTokens;
        
        // Burn the tokens - this naturally prevents double claiming since the balance will be 0 after claiming
        rangeBetToken.burn(msg.sender, tokenId, userBalance);
        
        // Update market state
        market.collateralBalance -= reward;
        
        // Transfer the reward
        collateralToken.safeTransfer(msg.sender, reward);
        
        emit RewardClaimed(marketId, msg.sender, binIndex, reward);
    }

    /**
     * @dev Deactivates a market, preventing new bets
     * @param marketId The ID of the market to deactivate
     */
    function deactivateMarket(uint256 marketId) external onlyOwner {
        Market storage market = markets[marketId];
        require(!market.closed, "Market is already closed");
        market.active = false;
    }

    /**
     * @dev Activates a previously deactivated market
     * @param marketId The ID of the market to activate
     */
    function activateMarket(uint256 marketId) external onlyOwner {
        Market storage market = markets[marketId];
        require(!market.closed, "Market is already closed");
        market.active = true;
    }

    /**
     * @dev Gets the data for a specific market
     * @param marketId The ID of the market
     * @return active Whether the market is active
     * @return closed Whether the market is closed
     * @return tickSpacing The spacing between consecutive bins
     * @return minTick The minimum tick value
     * @return maxTick The maximum tick value
     * @return T The total supply of tokens in the market
     * @return collateralBalance The total collateral balance in the market
     * @return winningBin The winning bin (0 if not set)
     * @return openTimestamp The timestamp when the market was created
     * @return closeTimestamp The scheduled time when the market will close
     */
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
    ) {
        Market storage market = markets[marketId];
        return (
            market.active,
            market.closed,
            market.tickSpacing,
            market.minTick,
            market.maxTick,
            market.T,
            market.collateralBalance,
            market.winningBin,
            market.openTimestamp,
            market.closeTimestamp
        );
    }

    /**
     * @dev Gets the quantity of tokens in a specific bin
     * @param marketId The ID of the market
     * @param binIndex The bin index
     * @return The quantity of tokens in the bin
     */
    function getBinQuantity(uint256 marketId, int256 binIndex) external view returns (uint256) {
        return markets[marketId].q[binIndex];
    }

    /**
     * @dev Calculates the cost to buy tokens in a specific bin
     * @param marketId The ID of the market
     * @param binIndex The bin index
     * @param amount The amount of tokens to buy
     * @return The cost in collateral tokens
     */
    function calculateBinCost(uint256 marketId, int256 binIndex, uint256 amount) external view returns (uint256) {
        Market storage market = markets[marketId];
        if (!market.active || market.closed) return 0;
        if (binIndex < market.minTick || binIndex > market.maxTick) return 0;
        if (binIndex % int256(market.tickSpacing) != 0) return 0;
        
        return RangeBetMath.calculateCost(amount, market.q[binIndex], market.T);
    }

    /**
     * @dev Withdraws all collateral from the contract
     * @param to The address to which the collateral will be transferred
     */
    function withdrawAllCollateral(address to) external onlyOwner {
        uint256 amount = collateralToken.balanceOf(address(this));
        require(amount > 0, "No collateral to withdraw");
        
        collateralToken.safeTransfer(to, amount);
        
        emit CollateralWithdrawn(to, amount);
    }

    /**
     * @dev Gets the quantities of tokens in a range of bins from fromBinIndex to toBinIndex
     * @param marketId The ID of the market
     * @param fromBinIndex The starting bin index (inclusive)
     * @param toBinIndex The ending bin index (inclusive)
     * @return binIndices Array of bin indices
     * @return quantities Array of token quantities corresponding to each bin index
     */
    function getBinQuantitiesInRange(
        uint256 marketId,
        int256 fromBinIndex,
        int256 toBinIndex
    )
        external
        view
        returns (
            int256[] memory binIndices,
            uint256[] memory quantities
        )
    {
        Market storage market = markets[marketId];

        // Validate the range parameters
        require(fromBinIndex <= toBinIndex, "fromBinIndex must be <= toBinIndex");
        require(fromBinIndex >= market.minTick && toBinIndex <= market.maxTick, "Bin index out of range");
        require(fromBinIndex % int256(market.tickSpacing) == 0, "fromBinIndex not multiple of tickSpacing");
        require(toBinIndex % int256(market.tickSpacing) == 0, "toBinIndex not multiple of tickSpacing");

        // Calculate the number of bins in the range
        uint256 step = uint256((toBinIndex - fromBinIndex) / int256(market.tickSpacing)) + 1;

        // Allocate memory for the arrays
        binIndices = new int256[](step);
        quantities = new uint256[](step);

        // Populate the arrays with bin indices and quantities
        int256 currentBin = fromBinIndex;
        for (uint256 i = 0; i < step; i++) {
            binIndices[i] = currentBin;
            quantities[i] = market.q[currentBin];
            currentBin += int256(market.tickSpacing);
        }

        return (binIndices, quantities);
    }
} 