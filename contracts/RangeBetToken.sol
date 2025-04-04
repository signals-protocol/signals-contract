// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RangeBetToken
 * @dev ERC1155 token contract for the RangeBet prediction market.
 * Each token represents a position in a specific bin of a specific market.
 * tokenId = (marketId << 128) + (binIndex + OFFSET)
 */
contract RangeBetToken is ERC1155 {
    // Constants
    uint256 private constant OFFSET = 1e9; // Used to handle negative bin indices

    // State variables
    address public manager;

    // Events
    event TokenMinted(address indexed to, uint256 indexed tokenId, uint256 amount);
    event TokenBurned(address indexed from, uint256 indexed tokenId, uint256 amount);

    /**
     * @dev Constructor for RangeBetToken
     * @param uri_ Base URI for token metadata
     * @param manager_ Address of the RangeBetManager contract
     */
    constructor(string memory uri_, address manager_) ERC1155(uri_) {
        manager = manager_;
    }

    /**
     * @dev Restricts function to be called only by the manager
     */
    modifier onlyManager() {
        require(msg.sender == manager, "Only manager can call this function");
        _;
    }

    /**
     * @dev Mints tokens for a user
     * @param to Recipient address
     * @param id Token ID (encoded market ID and bin index)
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 id, uint256 amount) external onlyManager {
        _mint(to, id, amount, "");
        emit TokenMinted(to, id, amount);
    }

    /**
     * @dev Burns tokens from a user
     * @param from Address to burn tokens from
     * @param id Token ID (encoded market ID and bin index)
     * @param amount Amount of tokens to burn
     */
    function burn(address from, uint256 id, uint256 amount) external onlyManager {
        _burn(from, id, amount);
        emit TokenBurned(from, id, amount);
    }

    /**
     * @dev Encodes a market ID and bin index into a token ID
     * @param marketId ID of the market
     * @param binIndex Index of the bin
     * @return token ID
     */
    function encodeTokenId(uint256 marketId, int256 binIndex) public pure returns (uint256) {
        return (marketId << 128) + uint256(binIndex + int256(OFFSET));
    }

    /**
     * @dev Decodes a token ID into a market ID and bin index
     * @param tokenId Token ID to decode
     * @return marketId ID of the market
     * @return binIndex Index of the bin
     */
    function decodeTokenId(uint256 tokenId) public pure returns (uint256 marketId, int256 binIndex) {
        marketId = tokenId >> 128;
        binIndex = int256(tokenId & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) - int256(OFFSET);
    }

    /**
     * @dev Updates the manager address (can only be called by current manager)
     * @param newManager New manager address
     */
    function setManager(address newManager) external onlyManager {
        require(newManager != address(0), "New manager cannot be zero address");
        manager = newManager;
    }
} 