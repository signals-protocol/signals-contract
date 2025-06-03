// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockCollateralToken
 * @dev A simple ERC20 token to be used as collateral in tests
 */
contract MockCollateralToken is ERC20, Ownable {
    
    // State variables
    bool public freeMintEnabled = true;
    uint256 public freeMintAmount = 500 * 10**18; // 500 tokens (adjustable by owner)
    
    // Struct to track user mint information
    struct UserMintInfo {
        bool hasFreeMinted;          // 이 유저가 free mint 했는지 여부
        uint256 ownerMintCount;      // owner가 mint해준 횟수
        uint256 totalOwnerMinted;    // 지금까지 받은 총 액수(owner mint만)
    }
    
    // Mapping to store user mint information
    mapping(address => UserMintInfo) public userMintInfo;

    // Events
    event FreeMintClaimed(address indexed to, uint256 amount);
    event MintedTo(address indexed to, uint256 amount, uint256 totalCount);
    event FreeMintEnabledSet(bool enabled);
    event FreeMintAmountSet(uint256 oldAmount, uint256 newAmount);

    /**
     * @dev Constructor that gives the deployer all of existing tokens.
     * @param name Token name
     * @param symbol Token symbol
     * @param initialSupply Initial supply of tokens
     */
    constructor(string memory name, string memory symbol, uint256 initialSupply) 
        ERC20(name, symbol) 
        Ownable(msg.sender)
    {
        _mint(msg.sender, initialSupply);
    }

    /**
     * @dev Function to mint tokens by owner.
     * @param to The address that will receive the minted tokens
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");
        _mint(to, amount);
    }

    /**
     * @dev Special mint function by owner for specific users.
     * @param to The address that will receive the minted tokens
     * @param amount The amount of tokens to mint
     */
    function mintTo(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");
        
        UserMintInfo storage userInfo = userMintInfo[to];
        userInfo.ownerMintCount++;
        userInfo.totalOwnerMinted += amount;
        
        _mint(to, amount);
        emit MintedTo(to, amount, userInfo.ownerMintCount);
    }

    /**
     * @dev Allows anyone to claim free tokens for testing purposes (once per address).
     * @dev Can only be called once per address and when free mint is enabled.
     */
    function claimFreeMint() external {
        require(freeMintEnabled, "Free mint is currently disabled");
        require(!userMintInfo[msg.sender].hasFreeMinted, "Already claimed free tokens");
        
        userMintInfo[msg.sender].hasFreeMinted = true;
        _mint(msg.sender, freeMintAmount);
        emit FreeMintClaimed(msg.sender, freeMintAmount);
    }

    /**
     * @dev Set free mint functionality on/off (owner only).
     * @param enabled Whether free mint should be enabled
     */
    function setFreeMintEnabled(bool enabled) external onlyOwner {
        freeMintEnabled = enabled;
        emit FreeMintEnabledSet(enabled);
    }

    /**
     * @dev Set free mint amount (owner only).
     * @param amount New free mint amount
     */
    function setFreeMintAmount(uint256 amount) external onlyOwner {
        require(amount > 0, "Free mint amount must be greater than 0");
        uint256 oldAmount = freeMintAmount;
        freeMintAmount = amount;
        emit FreeMintAmountSet(oldAmount, amount);
    }

    /**
     * @dev Get user mint information.
     * @param user The address to check
     * @return hasFreeMinted Whether user has claimed free tokens
     * @return ownerMintCount Number of times owner has minted to this user
     * @return totalOwnerMinted Total amount minted by owner to this user
     */
    function getMintInfo(address user) external view returns (
        bool hasFreeMinted,
        uint256 ownerMintCount,
        uint256 totalOwnerMinted
    ) {
        UserMintInfo memory userInfo = userMintInfo[user];
        return (
            userInfo.hasFreeMinted,
            userInfo.ownerMintCount,
            userInfo.totalOwnerMinted
        );
    }

    /**
     * @dev Check if user can claim free tokens.
     * @param user The address to check
     * @return canClaim Whether user can claim free tokens
     */
    function canClaimFreeMint(address user) external view returns (bool canClaim) {
        return freeMintEnabled && !userMintInfo[user].hasFreeMinted;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
} 