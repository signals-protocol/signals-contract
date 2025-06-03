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
        uint256 totalRewardPool; // Total reward pool when market closed (for reward calculations)
        int256 winningBin;       // The winning bin (set when market is closed)
        int256 finalPrice;       // The final price when market is closed
        uint256 openTimestamp;   // Market creation (open) timestamp
        uint256 closeTimestamp;  // Time when the market is scheduled to close (metadata)
        mapping(int256 => uint256) q; // Quantity of tokens in each bin
    }

    // State variables
    RangeBetToken public rangeBetToken;
    IERC20 public collateralToken;
    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    uint256 public lastClosedMarketId;  // ID of the most recently closed market

    // Events
    event MarketCreated(uint256 indexed marketId, uint256 tickSpacing, int256 minTick, int256 maxTick, uint256 openTimestamp, uint256 closeTimestamp);
    event TokensBought(uint256 indexed marketId, address indexed buyer, int256[] binIndices, uint256[] amounts, uint256 totalCost);
    event TokensSold(uint256 indexed marketId, address indexed seller, int256[] binIndices, uint256[] amounts, uint256 totalRevenue);
    event MarketClosed(uint256 indexed marketId, int256 winningBin);
    event RewardClaimed(uint256 indexed marketId, address indexed claimer, int256 binIndex, uint256 tokenAmount, uint256 rewardAmount);
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
        // Initialize lastClosedMarketId to max uint256 to indicate no markets have been closed yet
        lastClosedMarketId = type(uint256).max;
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
     * @dev Creates multiple prediction markets in a single transaction
     * @param tickSpacings Array of tick spacings for each market
     * @param minTicks Array of minimum tick values (inclusive) for each market
     * @param maxTicks Array of maximum tick values (inclusive) for each market
     * @param closeTimes Array of scheduled close times for each market
     * @return marketIds Array of IDs of the newly created markets
     */
    function createBatchMarkets(
        uint256[] calldata tickSpacings,
        int256[] calldata minTicks,
        int256[] calldata maxTicks,
        uint256[] calldata closeTimes
    ) external onlyOwner returns (uint256[] memory marketIds) {
        // Check if input arrays have the same length
        uint256 numMarkets = tickSpacings.length;
        require(numMarkets > 0, "Must create at least one market");
        require(minTicks.length == numMarkets, "Array lengths must match");
        require(maxTicks.length == numMarkets, "Array lengths must match");
        require(closeTimes.length == numMarkets, "Array lengths must match");
        
        // Initialize the result array
        marketIds = new uint256[](numMarkets);
        
        // Create each market
        for (uint256 i = 0; i < numMarkets; i++) {
            uint256 tickSpacing = tickSpacings[i];
            int256 minTick = minTicks[i];
            int256 maxTick = maxTicks[i];
            uint256 closeTime = closeTimes[i];
            
            // Validate parameters (same as in createMarket)
            require(tickSpacing > 0, "Tick spacing must be positive");
            require(minTick % int256(tickSpacing) == 0, "Min tick must be a multiple of tick spacing");
            require(maxTick % int256(tickSpacing) == 0, "Max tick must be a multiple of tick spacing");
            require(minTick < maxTick, "Min tick must be less than max tick");
            
            // Assign a new market ID
            uint256 marketId = marketCount;
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
            market.closeTimestamp = closeTime;       
            
            emit MarketCreated(marketId, tickSpacing, minTick, maxTick, market.openTimestamp, market.closeTimestamp);
            
            // Store the marketId in the result array
            marketIds[i] = marketId;
        }
        
        return marketIds;
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
     * @dev Sells tokens in multiple bins for a specific market
     * @param marketId The ID of the market
     * @param binIndices Array of bin indices where tokens will be sold
     * @param amounts Array of token amounts to sell for each bin
     * @param minRevenue Minimum amount of collateral the user expects to receive
     */
    function sellTokens(
        uint256 marketId,
        int256[] calldata binIndices,
        uint256[] calldata amounts,
        uint256 minRevenue
    ) external nonReentrant {
        Market storage market = markets[marketId];
        require(market.active, "Market is not active");
        require(!market.closed, "Market is closed");
        require(binIndices.length == amounts.length, "Array lengths must match");
        require(binIndices.length > 0, "Must sell at least one bin");
        
        uint256 totalRevenue = 0;
        uint256 Tcurrent = market.T;
        
        // 1) Prepare: create tokenIds and burnAmounts arrays
        uint256 len = binIndices.length;
        uint256[] memory tokenIds = new uint256[](len);
        uint256[] memory burnAmounts = new uint256[](len);
        
        // 2) Process each bin
        for (uint256 i = 0; i < len; i++) {
            int256 binIndex = binIndices[i];
            uint256 amount = amounts[i];
            
            // Skip if amount is 0
            if (amount == 0) continue;
            
            require(binIndex % int256(market.tickSpacing) == 0, "Bin index must be a multiple of tick spacing");
            require(binIndex >= market.minTick && binIndex <= market.maxTick, "Bin index out of range");
            
            // Check user has enough tokens to sell
            uint256 tokenId = rangeBetToken.encodeTokenId(marketId, binIndex);
            uint256 userBalance = rangeBetToken.balanceOf(msg.sender, tokenId);
            require(userBalance >= amount, "Insufficient token balance");
            
            // Calculate revenue for this bin
            uint256 qBin = market.q[binIndex];
            require(qBin >= amount, "Not enough tokens in bin to sell");
            
            uint256 revenue = RangeBetMath.calculateSellCost(amount, qBin, Tcurrent);
            
            // Update state
            market.q[binIndex] = qBin - amount;
            Tcurrent -= amount;
            totalRevenue += revenue;
            
            // Save tokenId and burnAmount
            tokenIds[i] = tokenId;
            burnAmounts[i] = amount;
        }
        
        // Check if the revenue meets the user's minimum expectation
        require(totalRevenue >= minRevenue, "Revenue below minimum expected");
        
        // Update market state
        market.T = Tcurrent;
        market.collateralBalance -= totalRevenue;
        
        // Execute individual burn operations
        for (uint256 i = 0; i < len; i++) {
            if (burnAmounts[i] > 0) {
                rangeBetToken.burn(msg.sender, tokenIds[i], burnAmounts[i]);
            }
        }
        
        // Transfer collateral to user
        collateralToken.safeTransfer(msg.sender, totalRevenue);
        
        emit TokensSold(marketId, msg.sender, binIndices, amounts, totalRevenue);
    }

    /**
     * @dev Converts a price to the corresponding bin index
     * @param price The actual price value
     * @param tickSpacing The tick spacing of the market
     * @return binIndex The bin index that contains the price
     */
    function priceToBinIndex(int256 price, uint256 tickSpacing) public pure returns (int256 binIndex) {
        // Calculate which bin the price falls into
        // Bin index a represents the range [a, a + tickSpacing)
        // So we need to find the largest multiple of tickSpacing that is <= price
        if (price >= 0) {
            binIndex = (price / int256(tickSpacing)) * int256(tickSpacing);
        } else {
            // For negative prices, we need to handle rounding differently
            // to ensure the bin contains the price
            int256 quotient = price / int256(tickSpacing);
            if (price % int256(tickSpacing) != 0) {
                quotient -= 1; // Round down for negative numbers
            }
            binIndex = quotient * int256(tickSpacing);
        }
    }

    /**
     * @dev Closes the next market in sequence and sets the winning bin based on actual price
     * @param actualPrice The actual price value where the market settled
     */
    function closeMarket(int256 actualPrice) external onlyOwner {
        // Calculate the next market ID to close
        uint256 marketId;
        
        if (lastClosedMarketId == type(uint256).max) {
            // Close the first market
            marketId = 0;
        } else {
            // Close the next market
            marketId = lastClosedMarketId + 1;
        }
        
        // Check if the market exists
        require(marketId < marketCount, "No more markets to close");
        
        Market storage market = markets[marketId];
        require(market.active, "Market is not active");
        require(!market.closed, "Market is already closed");
        
        // Convert price to bin index
        int256 winningBin = priceToBinIndex(actualPrice, market.tickSpacing);
        
        // Validate that the winning bin is within the market range
        require(winningBin >= market.minTick && winningBin <= market.maxTick, "Price is outside market range");
        
        market.closed = true;
        market.winningBin = winningBin;
        market.finalPrice = actualPrice;
        market.totalRewardPool = market.collateralBalance;
        
        // Update the last closed market ID
        lastClosedMarketId = marketId;
        
        emit MarketClosed(marketId, winningBin);
    }

    /**
     * @dev Claims rewards for a winning position in a market
     * @param marketId The ID of the market
     * @param tokenAmount The amount of tokens to claim rewards for (0 means claim all)
     */
    function claimReward(uint256 marketId, uint256 tokenAmount) external nonReentrant {
        Market storage market = markets[marketId];
        require(market.closed, "Market is not closed");
        
        int256 winningBin = market.winningBin;
        uint256 tokenId = rangeBetToken.encodeTokenId(marketId, winningBin);
        uint256 userBalance = rangeBetToken.balanceOf(msg.sender, tokenId);
        require(userBalance > 0, "No tokens to claim");
        
        // If tokenAmount is 0, claim all tokens
        uint256 claimAmount = tokenAmount == 0 ? userBalance : tokenAmount;
        require(userBalance >= claimAmount, "Insufficient tokens to claim");
        
        uint256 totalWinningTokens = market.q[winningBin];
        uint256 reward = (claimAmount * market.totalRewardPool) / totalWinningTokens;
        
        // Burn the specified amount of tokens
        rangeBetToken.burn(msg.sender, tokenId, claimAmount);
        
        // Update market state
        market.collateralBalance -= reward;
        
        // Transfer the reward
        collateralToken.safeTransfer(msg.sender, reward);
        
        emit RewardClaimed(marketId, msg.sender, winningBin, claimAmount, reward);
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
     * @return finalPrice The final price when market is closed (0 if not closed)
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
        int256 finalPrice,
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
            market.finalPrice,
            market.openTimestamp,
            market.closeTimestamp
        );
    }

    /**
     * @dev Gets the last closed market ID
     * @return The ID of the last closed market or type(uint256).max if no market has been closed
     */
    function getLastClosedMarketId() external view returns (uint256) {
        return lastClosedMarketId;
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
     * @dev Calculates the amount of tokens that can be bought with the given cost for a specific bin
     * @param marketId The ID of the market
     * @param binIndex The bin index
     * @param cost The amount of collateral to spend
     * @return The amount of tokens that can be bought with the given cost
     */
    function calculateXForBin(uint256 marketId, int256 binIndex, uint256 cost) external view returns (uint256) {
        Market storage market = markets[marketId];
        if (!market.active || market.closed) return 0;
        if (binIndex < market.minTick || binIndex > market.maxTick) return 0;
        if (binIndex % int256(market.tickSpacing) != 0) return 0;
        
        return RangeBetMath.calculateX(cost, market.q[binIndex], market.T);
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

    /**
     * @dev A view function to calculate the revenue (collateral) when selling tokens
     * @param marketId The market ID
     * @param binIndex The bin index
     * @param amount The token amount to sell
     * @return sellRevenue The revenue from selling the specified amount of tokens in the bin
     */
    function calculateBinSellCost(
        uint256 marketId,
        int256 binIndex,
        uint256 amount
    )
        external
        view
        returns (uint256 sellRevenue)
    {
        // 1) Get market information
        Market storage market = markets[marketId];
        
        // 2) Validate market state
        // "Theoretical" calculation is possible even for closed markets
        require(market.active || market.closed, "Market is not active or closed");
        
        // Check if the bin is valid
        require(binIndex % int256(market.tickSpacing) == 0, "Bin index must be a multiple of tick spacing");
        require(binIndex >= market.minTick && binIndex <= market.maxTick, "Bin index out of range");

        // 3) Get tokens in the bin (q) and total supply (T)
        uint256 qBin = market.q[binIndex];
        uint256 Tcurrent = market.T;

        // 4) Calculate revenue using RangeBetMath (additional validation inside the function)
        sellRevenue = RangeBetMath.calculateSellCost(
            amount, 
            qBin, 
            Tcurrent
        );

        return sellRevenue;
    }
} 